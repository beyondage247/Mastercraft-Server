import { Injectable, Logger } from '@nestjs/common';
import { Prisma, ProjectStageType, ProjectStatus, Role } from '@prisma/client';
import { IAuthUser } from 'src/modules/auth/auth.types';
import { MailService } from 'src/services/mail/mail.service';
import { PrismaService } from 'src/services/prisma/prisma.service';
import {
  connectId,
  createAttachments,
} from 'src/services/prisma/prisma.utils';
import { bad } from 'src/utils/error.utils';
import {
  CreateProjectInput,
  CreateProjectCommentInput,
  CreateProjectStageInput,
  UpdateProjectAttachmentInput,
  UpdateProjectStageInput,
  UpdateProjectStatusInput,
} from './project.types';

export const iUpload = {
  select: {
    id: true,
    name: true,
    size: true,
  },
} satisfies Prisma.UploadDefaultArgs;

export const iAttachments = {
  select: {
    uploads: { ...iUpload },
  },
} satisfies Prisma.AttachmentDefaultArgs;

const projectCommentSelect = {
  select: {
    id: true,
    message: true,
    createdAt: true,
    user: {
      select: {
        id: true,
        name: true,
        role: true,
      },
    },
  },
} satisfies Prisma.ProjectCommentDefaultArgs;

const PROJECT_STAGE_LABELS: Record<ProjectStageType, string> = {
  [ProjectStageType.MIL]: 'MIL',
  [ProjectStageType.BUILD_ASSEMBLE]: 'Build/Assemble',
  [ProjectStageType.FINISHING]: 'Finishing',
  [ProjectStageType.DELIVERY]: 'Delivery',
  [ProjectStageType.INSTALL]: 'Install',
};

const projectSelect = {
  id: true,
  clientId: true,
  fabrication: true,
  description: true,
  location: true,
  name: true,
  status: true,
  paymentStatus: true,
  startDate: true,
  endDate: true,
  createdAt: true,
  quotes: {
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      quoteId: true,
      status: true,
      validUntil: true,
      invoices: {
        orderBy: {
          createdAt: 'desc',
        },
        select: {
          id: true,
          invoiceId: true,
          status: true,
          total: true,
          createdAt: true,
        },
      },
    },
  },
  client: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      additionalContact: true,
      additionalEmail: true,
      clientCredit: true,
      accountPartnerId: true,
      accountPartner: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  },
  stages: {
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      id: true,
      stage: true,
      hoursBudgeted: true,
      hoursSpent: true,
      progress: true,
      startDate: true,
    },
  },
  payments: {
    orderBy: {
      createdAt: 'desc',
    },
    select: {
      id: true,
      invoiceId: true,
      createdAt: true,
      method: true,
      reference: true,
      amount: true,
    },
  },
  attachment: { ...iAttachments },
  comments: {
    orderBy: {
      createdAt: 'asc',
    },
    ...projectCommentSelect,
  },
} satisfies Prisma.ProjectSelect;

@Injectable()
export class ProjectsService {
  private readonly logger = new Logger(ProjectsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async getProjectList(user: IAuthUser) {
    return this.prisma.project.findMany({
      where: this.getProjectVisibilityWhere(user),
      orderBy: {
        createdAt: 'desc',
      },
      select: projectSelect,
    });
  }

  async getClientProjects(clientId: string, user: IAuthUser) {
    const client = await this.prisma.user.findFirst({
      where: {
        id: clientId,
        role: Role.CLIENT,
      },
      select: {
        id: true,
        accountPartnerId: true,
      },
    });

    if (!client) bad('Client not found', 404);

    if (!user.isAdmin && client.accountPartnerId !== user.id) {
      bad('You can only view projects for clients you are managing', 403);
    }

    return this.prisma.project.findMany({
      where: { clientId },
      orderBy: {
        createdAt: 'desc',
      },
      select: projectSelect,
    });
  }

  async getProject(projectId: string, user: IAuthUser) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        clientId: true,
        client: {
          select: {
            accountPartnerId: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!project) bad('Project not found', 404);

    if (user.role === Role.CLIENT && project.clientId !== user.id) {
      bad('You can only view your own projects', 403);
    }

    if (
      user.role === Role.STAFF &&
      !user.isAdmin &&
      project.client.accountPartnerId !== user.id
    ) {
      bad('You can only view projects for clients you are managing', 403);
    }

    const fullProject = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: projectSelect,
    });

    if (!fullProject) bad('Project not found', 404);

    return fullProject;
  }

  async createProject(dto: CreateProjectInput, user: IAuthUser) {
    const client = await this.prisma.user.findFirst({
      where: {
        id: dto.clientId,
        role: Role.CLIENT,
      },
      select: {
        id: true,
        name: true,
        email: true,
        accountPartnerId: true,
      },
    });

    if (!client) bad('Client not found', 404);

    if (!user.isAdmin && !client.accountPartnerId) {
      bad('Client is not assigned to an account partner', 403);
    }

    if (!user.isAdmin && client.accountPartnerId !== user.id) {
      bad(
        'Only the client account partner can create a project for this client',
        403,
      );
    }

    const projectStartDate = new Date(dto.startDate);
    const projectEndDate = new Date(dto.endDate);

    if (projectEndDate < projectStartDate) {
      bad('Project end date must be on or after the project start date');
    }

    const stages = [
      this.toStageCreateInput(
        'MIL',
        ProjectStageType.MIL,
        dto.mil,
        projectStartDate,
        projectEndDate,
      ),
      this.toStageCreateInput(
        'Build/Assemble',
        ProjectStageType.BUILD_ASSEMBLE,
        dto.buildAssemble,
        projectStartDate,
        projectEndDate,
      ),
      this.toStageCreateInput(
        'Finishing',
        ProjectStageType.FINISHING,
        dto.finishing,
        projectStartDate,
        projectEndDate,
      ),
      this.toStageCreateInput(
        'Delivery',
        ProjectStageType.DELIVERY,
        dto.delivery,
        projectStartDate,
        projectEndDate,
      ),
      this.toStageCreateInput(
        'Install',
        ProjectStageType.INSTALL,
        dto.install,
        projectStartDate,
        projectEndDate,
      ),
    ];

    const project = await this.prisma.project.create({
      data: {
        client: connectId(dto.clientId),
        fabrication: dto.fabrication,
        description: dto.description,
        location: dto.location,
        name: dto.name,
        status: ProjectStatus.PENDING,
        startDate: projectStartDate,
        endDate: projectEndDate,
        stages: {
          create: stages,
        },
      },
      select: projectSelect,
    });

    void this.mail
      .sendProjectCreatedMail({
        recipientName: client.name,
        recipientEmail: client.email,
        projectName: project.name,
        location: project.location,
        description: project.description,
        fabrication: project.fabrication.toString(),
        startDate: this.formatDate(project.startDate),
        endDate: this.formatDate(project.endDate),
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to send project creation notification for project ${project.id}`,
          error,
        );
      });

    return {
      message: 'Project created successfully',
      project,
    };
  }

  async updateProjectStatus(
    projectId: string,
    dto: UpdateProjectStatusInput,
    user: IAuthUser,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
        client: {
          select: {
            accountPartnerId: true,
          },
        },
      },
    });

    if (!project) bad('Project not found', 404);

    if (!user.isAdmin && project.client.accountPartnerId !== user.id) {
      bad('You can only update projects for clients you are managing', 403);
    }

    const operations: Prisma.PrismaPromise<unknown>[] = [];

    if (dto.status) {
      if (dto.status !== ProjectStatus.COMPLETED) {
        bad('Only COMPLETED can be set manually on a project');
      }

      if (project.status !== ProjectStatus.IN_PRODUCTION) {
        bad(
          'A project can only be marked as COMPLETED after it reaches IN_PRODUCTION',
        );
      }

      operations.push(
        this.prisma.project.update({
          where: { id: projectId },
          data: { status: dto.status },
        }),
      );
    }

    this.pushStageUpdate(
      operations,
      projectId,
      project.startDate,
      project.endDate,
      ProjectStageType.MIL,
      dto.mil,
    );
    this.pushStageUpdate(
      operations,
      projectId,
      project.startDate,
      project.endDate,
      ProjectStageType.BUILD_ASSEMBLE,
      dto.buildAssemble,
    );
    this.pushStageUpdate(
      operations,
      projectId,
      project.startDate,
      project.endDate,
      ProjectStageType.FINISHING,
      dto.finishing,
    );
    this.pushStageUpdate(
      operations,
      projectId,
      project.startDate,
      project.endDate,
      ProjectStageType.DELIVERY,
      dto.delivery,
    );
    this.pushStageUpdate(
      operations,
      projectId,
      project.startDate,
      project.endDate,
      ProjectStageType.INSTALL,
      dto.install,
    );

    if (!operations.length) {
      bad(
        'Provide at least one update: project status or one of the stage fields',
      );
    }

    await this.prisma.$transaction(operations);

    const updatedProject = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: projectSelect,
    });

    if (!updatedProject) bad('Project not found', 404);

    const updatedSections = this.getUpdatedSections(dto);

    void this.mail
      .sendProjectUpdatedMail({
        recipientName: updatedProject.client.name,
        recipientEmail: updatedProject.client.email,
        projectName: updatedProject.name,
        location: updatedProject.location,
        description: updatedProject.description,
        fabrication: updatedProject.fabrication.toString(),
        startDate: this.formatDate(updatedProject.startDate),
        endDate: this.formatDate(updatedProject.endDate),
        projectStatus: this.formatProjectStatus(updatedProject.status),
        updatedSummary: updatedSections.join(', '),
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Failed to send project update notification for project ${updatedProject.id}`,
          error,
        );
      });

    return {
      message: 'Project updated successfully',
      project: updatedProject,
    };
  }

  async updateProjectAttachment(
    projectId: string,
    dto: UpdateProjectAttachmentInput,
    user: IAuthUser,
  ) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        name: true,
        clientId: true,
        attachmentId: true,
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            accountPartnerId: true,
            accountPartner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!project) bad('Project not found', 404);

    if (user.role === Role.CLIENT && project.clientId !== user.id) {
      bad('You can only update attachments on your own projects', 403);
    }

    if (
      user.role === Role.STAFF &&
      !user.isAdmin &&
      project.client.accountPartnerId !== user.id
    ) {
      bad('You can only update projects for clients you are managing', 403);
    }

    const uploadIds = [...new Set(dto.attachment.uploadIds)];
    const uploadCount = await this.prisma.upload.count({
      where: {
        id: {
          in: uploadIds,
        },
        ...(user.role === Role.CLIENT ? { userId: user.id } : {}),
      },
    });

    if (uploadCount !== uploadIds.length) {
      bad('One or more uploads were not found', 404);
    }

    const updatedProject = await this.prisma.project.update({
      where: { id: projectId },
      data: project.attachmentId
        ? {
            attachment: {
              update: {
                uploads: {
                  set: uploadIds.map((id) => ({ id })),
                },
              },
            },
          }
        : {
            attachment: createAttachments(uploadIds),
          },
      select: projectSelect,
    });

    const notificationRecipients =
      user.role === Role.CLIENT
        ? this.getUniqueRecipients([
            project.client.accountPartner
              ? {
                  id: project.client.accountPartner.id,
                  name: project.client.accountPartner.name,
                  email: project.client.accountPartner.email,
                }
              : null,
            ...(await this.getAdminRecipients([project.client.accountPartnerId])),
          ])
        : this.getUniqueRecipients([
            {
              id: project.client.id,
              name: project.client.name,
              email: project.client.email,
            },
          ]);

    if (notificationRecipients.length) {
      const documentNames = updatedProject.attachment?.uploads.length
        ? updatedProject.attachment.uploads.map((upload) => upload.name).join(', ')
        : 'Project documents';

      void Promise.all(
        notificationRecipients.map((recipient) =>
          this.mail.sendProjectAttachmentMail({
            recipientName: recipient.name,
            recipientEmail: recipient.email,
            projectName: updatedProject.name,
            uploaderName:
              user.role === Role.CLIENT
                ? updatedProject.client.name
                : 'Staff team',
            uploaderRole: user.role,
            documentNames,
          }),
        ),
      ).catch((error: unknown) => {
        this.logger.error(
          `Failed to send project attachment notification for project ${project.id}`,
          error,
        );
      });
    }

    return {
      message: 'Project attachment updated successfully',
      project: updatedProject,
    };
  }

  async createProjectComment(dto: CreateProjectCommentInput, user: IAuthUser) {
    const project = await this.prisma.project.findUnique({
      where: { id: dto.projectId },
      select: {
        id: true,
        name: true,
        clientId: true,
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            accountPartnerId: true,
            accountPartner: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
        },
      },
    });

    if (!project) bad('Project not found', 404);

    if (user.role === Role.CLIENT && project.clientId !== user.id) {
      bad('You can only comment on your own projects', 403);
    }

    if (
      user.role === Role.STAFF &&
      !user.isAdmin &&
      project.client.accountPartnerId !== user.id
    ) {
      bad('You can only comment on projects for clients you are managing', 403);
    }

    const message = dto.message.trim();
    if (!message) bad('message is required');

    const comment = await this.prisma.projectComment.create({
      data: {
        message,
        project: connectId(dto.projectId),
        user: connectId(user.id),
      },
      ...projectCommentSelect,
    });

    const notificationRecipients =
      user.role === Role.CLIENT
        ? this.getUniqueRecipients([
            project.client.accountPartner
              ? {
                  id: project.client.accountPartner.id,
                  name: project.client.accountPartner.name,
                  email: project.client.accountPartner.email,
                }
              : null,
            ...(await this.getAdminRecipients([project.client.accountPartnerId])),
          ])
        : this.getUniqueRecipients([
            {
              id: project.client.id,
              name: project.client.name,
              email: project.client.email,
            },
          ]);

    if (notificationRecipients.length) {
      void Promise.all(
        notificationRecipients.map((recipient) =>
          this.mail.sendProjectCommentMail({
            recipientName: recipient.name,
            recipientEmail: recipient.email,
            projectName: project.name,
            commenterName: comment.user.name,
            commenterRole: comment.user.role,
            message: comment.message,
          }),
        ),
      ).catch((error: unknown) => {
        this.logger.error(
          `Failed to send project comment notification for project ${project.id}`,
          error,
        );
      });
    }

    return {
      message: 'Project comment added successfully',
      comment,
    };
  }

  private toStageCreateInput(
    label: string,
    stage: ProjectStageType,
    input: CreateProjectStageInput | undefined,
    projectStartDate: Date,
    projectEndDate: Date,
  ) {
    if (!input) {
      return {
        stage,
        hoursBudgeted: 0,
        hoursSpent: 0,
        progress: 0,
        startDate: projectStartDate,
      };
    }

    const startDate = new Date(input.startDate);

    if (startDate < projectStartDate) {
      bad(`${label} stage start date cannot be before the project start date`);
    }

    if (startDate > projectEndDate) {
      bad(`${label} stage start date cannot be after the project end date`);
    }

    return {
      stage,
      hoursBudgeted: input.hoursBudgeted,
      hoursSpent: input.hoursSpent ?? 0,
      progress: input.progress ?? 0,
      startDate,
    };
  }

  private pushStageUpdate(
    operations: Prisma.PrismaPromise<unknown>[],
    projectId: string,
    projectStartDate: Date,
    projectEndDate: Date,
    stage: ProjectStageType,
    input?: UpdateProjectStageInput,
  ) {
    if (!input) return;

    const data: Prisma.ProjectStageUpdateInput = {};

    if (input.hoursBudgeted !== undefined) {
      data.hoursBudgeted = input.hoursBudgeted;
    }

    if (input.hoursSpent !== undefined) {
      data.hoursSpent = input.hoursSpent;
    }

    if (input.progress !== undefined) {
      data.progress = input.progress;
    }

    if (input.startDate !== undefined) {
      const startDate = new Date(input.startDate);

      if (startDate < projectStartDate) {
        bad(
          `${stage} stage start date cannot be before the project start date`,
        );
      }

      if (startDate > projectEndDate) {
        bad(`${stage} stage start date cannot be after the project end date`);
      }

      data.startDate = startDate;
    }

    if (!Object.keys(data).length) return;

    operations.push(
      this.prisma.projectStage.update({
        where: {
          projectId_stage: {
            projectId,
            stage,
          },
        },
        data,
      }),
    );
  }

  private hasStageUpdates(input?: UpdateProjectStageInput) {
    if (!input) return false;

    return (
      input.hoursBudgeted !== undefined ||
      input.hoursSpent !== undefined ||
      input.progress !== undefined ||
      input.startDate !== undefined
    );
  }

  private getUpdatedSections(dto: UpdateProjectStatusInput) {
    const sections: string[] = [];

    if (dto.status !== undefined) {
      sections.push('Project status');
    }

    if (this.hasStageUpdates(dto.mil)) {
      sections.push(`${PROJECT_STAGE_LABELS[ProjectStageType.MIL]} stage`);
    }

    if (this.hasStageUpdates(dto.buildAssemble)) {
      sections.push(
        `${PROJECT_STAGE_LABELS[ProjectStageType.BUILD_ASSEMBLE]} stage`,
      );
    }

    if (this.hasStageUpdates(dto.finishing)) {
      sections.push(`${PROJECT_STAGE_LABELS[ProjectStageType.FINISHING]} stage`);
    }

    if (this.hasStageUpdates(dto.delivery)) {
      sections.push(`${PROJECT_STAGE_LABELS[ProjectStageType.DELIVERY]} stage`);
    }

    if (this.hasStageUpdates(dto.install)) {
      sections.push(`${PROJECT_STAGE_LABELS[ProjectStageType.INSTALL]} stage`);
    }

    return sections;
  }

  private getProjectVisibilityWhere(
    user: IAuthUser,
  ): Prisma.ProjectWhereInput | undefined {
    if (user.role === Role.CLIENT) {
      return {
        clientId: user.id,
      };
    }

    if (user.isAdmin) {
      return undefined;
    }

    return {
      client: {
        accountPartnerId: user.id,
      },
    };
  }

  private formatDate(value: Date) {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(value);
  }

  private formatProjectStatus(value: ProjectStatus) {
    return value
      .toLowerCase()
      .split('_')
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  }

  private async getAdminRecipients(excludedIds: Array<string | null | undefined>) {
    const exclude = excludedIds.filter((id): id is string => Boolean(id));
    const admins = await this.prisma.user.findMany({
      where: {
        role: Role.STAFF,
        isAdmin: true,
        ...(exclude.length ? { id: { notIn: exclude } } : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
      },
    });

    return admins;
  }

  private getUniqueRecipients(
    recipients: Array<
      | {
          id: string;
          name: string;
          email: string;
        }
      | null
      | undefined
    >,
  ) {
    const seen = new Set<string>();

    return recipients.filter((recipient): recipient is {
      id: string;
      name: string;
      email: string;
    } => {
      if (!recipient) return false;
      const key = recipient.email.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
