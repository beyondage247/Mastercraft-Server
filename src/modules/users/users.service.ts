import { Injectable, Logger } from '@nestjs/common';
import { Role } from '@prisma/client';
import { hash } from 'argon2';
import { PrismaService } from 'src/services/prisma/prisma.service';
import {
  ClientListQuery,
  CreateClientInput,
  CreateStaffInput,
  ReassignClientInput,
  UpdateClientInput,
  UpdateStaffInput,
} from './user.types';
import { generatePassword } from 'src/utils/password.utils';
import { MailService } from 'src/services/mail/mail.service';
import { bad } from 'src/utils/error.utils';
import { IAuthUser } from '../auth/auth.types';
import { connectId } from 'src/services/prisma/prisma.utils';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  async getStaffList() {
    return this.prisma.user.findMany({
      where: { role: Role.STAFF },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isAdmin: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getClientList(user: IAuthUser, query: ClientListQuery = {}) {
    return this.prisma.user.findMany({
      where: {
        role: Role.CLIENT,
        isArchived: query.archived ?? false,
        ...(user.isAdmin ? {} : { accountPartnerId: user.id }),
      },
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
        isArchived: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createStaff(dto: CreateStaffInput, _user?: IAuthUser) {
    const { name, email, isAdmin } = dto;

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) bad('User already exists');
    const tempPassword = generatePassword();
    const hashedPassword = await hash(tempPassword);
    await this.prisma.user.create({
      data: {
        name,
        email,
        isAdmin,
        role: Role.STAFF,
        password: hashedPassword,
      },
    });

    void this.mail
      .sendNewStaffMail({
        name,
        email,
        tempPassword,
      })
      .catch((error: unknown) => {
        this.logger.error(`Failed to send new staff email to ${email}`, error);
      });

    return {
      message: 'Staff created successfully',
    };
  }

  async createClient(dto: CreateClientInput, user: IAuthUser) {
    const { staffId, name, email, ...rest } = dto;

    if (!user.isAdmin && staffId !== user.id) {
      bad('You can only assign clients to yourself', 403);
    }

    const staff = await this.prisma.user.findFirst({
      where: {
        id: staffId,
        role: Role.STAFF,
      },
      select: {
        id: true,
      },
    });
    if (!staff) bad('Staff user not found', 404);

    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) bad('User already exists');
    const tempPassword = generatePassword();
    const hashedPassword = await hash(tempPassword);

    await this.prisma.user.create({
      data: {
        ...rest,
        name,
        email,
        role: Role.CLIENT,
        password: hashedPassword,
        accountPartner: connectId(staffId),
      },
    });

    void this.mail
      .sendNewClientMail({
        name,
        email,
        tempPassword,
        company: dto.company,
        phone: dto.phone,
      })
      .catch((error: unknown) => {
        this.logger.error(`Failed to send new client email to ${email}`, error);
      });

    return {
      message: 'Client created successfully',
    };
  }

  async updateClient(id: string, dto: UpdateClientInput, user: IAuthUser) {
    const client = await this.prisma.user.findFirst({
      where: { id, role: Role.CLIENT },
      select: { id: true, accountPartnerId: true },
    });
    if (!client) bad('Client not found', 404);

    if (!user.isAdmin && client.accountPartnerId !== user.id) {
      bad('You can only edit clients assigned to you', 403);
    }

    if (!Object.keys(dto).length) {
      bad('At least one field is required');
    }

    if (dto.email) {
      const conflict = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id } },
        select: { id: true },
      });
      if (conflict) bad('Email is already in use');
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.phone !== undefined && { phone: dto.phone }),
        ...(dto.company !== undefined && { company: dto.company }),
        ...(dto.additionalContact !== undefined && { additionalContact: dto.additionalContact }),
        ...(dto.additionalEmail !== undefined && { additionalEmail: dto.additionalEmail }),
        ...(dto.clientCredit !== undefined && { clientCredit: dto.clientCredit }),
      },
    });

    return { message: 'Client updated successfully' };
  }

  async updateStaff(id: string, dto: UpdateStaffInput, user: IAuthUser) {
    if (!user.isAdmin) bad('Only administrators can edit staff accounts', 403);

    const staff = await this.prisma.user.findFirst({
      where: { id, role: Role.STAFF },
      select: { id: true },
    });
    if (!staff) bad('Staff user not found', 404);

    if (!Object.keys(dto).length) {
      bad('At least one field is required');
    }

    if (dto.email) {
      const conflict = await this.prisma.user.findFirst({
        where: { email: dto.email, NOT: { id } },
        select: { id: true },
      });
      if (conflict) bad('Email is already in use');
    }

    await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.email !== undefined && { email: dto.email }),
        ...(dto.isAdmin !== undefined && { isAdmin: dto.isAdmin }),
      },
    });

    return { message: 'Staff updated successfully' };
  }

  async reassignClient(dto: ReassignClientInput) {
    const client = await this.prisma.user.findFirst({
      where: {
        id: dto.clientId,
        role: Role.CLIENT,
      },
      select: {
        id: true,
      },
    });
    if (!client) bad('Client not found');

    const staff = await this.prisma.user.findFirst({
      where: {
        id: dto.staffId,
        role: Role.STAFF,
      },
      select: {
        id: true,
      },
    });
    if (!staff) bad('Staff user not found');

    await this.prisma.user.update({
      where: { id: dto.clientId },
      data: {
        accountPartner: connectId(dto.staffId),
      },
    });

    return {
      message: 'Client reassigned successfully',
    };
  }

  async archiveClient(clientId: string) {
    const client = await this.prisma.user.findFirst({
      where: { id: clientId, role: Role.CLIENT },
      select: { id: true, isArchived: true },
    });
    if (!client) bad('Client not found', 404);
    if (client.isArchived) bad('Client is already archived');

    await this.prisma.user.update({
      where: { id: clientId },
      data: { isArchived: true },
    });
    return { message: 'Client archived successfully' };
  }

  async restoreClient(clientId: string) {
    const client = await this.prisma.user.findFirst({
      where: { id: clientId, role: Role.CLIENT },
      select: { id: true, isArchived: true },
    });
    if (!client) bad('Client not found', 404);
    if (!client.isArchived) bad('Client is not archived');

    await this.prisma.user.update({
      where: { id: clientId },
      data: { isArchived: false },
    });
    return { message: 'Client restored successfully' };
  }

  async deleteClient(clientId: string) {
    const client = await this.prisma.user.findFirst({
      where: { id: clientId, role: Role.CLIENT },
      select: {
        id: true,
        uploads: { select: { id: true } },
        projectDocuments: { select: { uploadId: true } },
        projects: {
          select: {
            id: true,
            attachmentId: true,
            attachment: { select: { uploads: { select: { id: true } } } },
            documents: { select: { uploadId: true } },
          },
        },
      },
    });
    if (!client) bad('Client not found', 404);

    const attachmentIds = client.projects
      .filter((p) => p.attachmentId)
      .map((p) => p.attachmentId!);

    const uploadIdsToDelete = [
      ...new Set([
        ...client.uploads.map((u) => u.id),
        ...client.projectDocuments.map((d) => d.uploadId),
        ...client.projects.flatMap((p) => p.documents.map((d) => d.uploadId)),
        ...client.projects.flatMap(
          (p) => p.attachment?.uploads.map((u) => u.id) ?? [],
        ),
      ]),
    ];

    await this.prisma.$transaction(async (tx) => {
      await tx.user.delete({ where: { id: clientId } });
      if (attachmentIds.length) {
        await tx.attachment.deleteMany({ where: { id: { in: attachmentIds } } });
      }
      if (uploadIdsToDelete.length) {
        await tx.upload.deleteMany({ where: { id: { in: uploadIdsToDelete } } });
      }
    });

    return { message: 'Client deleted successfully' };
  }

  async resendClientInvitation(clientId: string, user: IAuthUser) {
    const client = await this.prisma.user.findFirst({
      where: { id: clientId, role: Role.CLIENT },
      select: { id: true, name: true, email: true, phone: true, company: true, accountPartnerId: true },
    });
    if (!client) bad('Client not found', 404);

    if (!user.isAdmin && client.accountPartnerId !== user.id) {
      bad('You can only resend invitations for clients assigned to you', 403);
    }

    const tempPassword = generatePassword();
    const hashedPassword = await hash(tempPassword);
    await this.prisma.user.update({
      where: { id: clientId },
      data: { password: hashedPassword },
    });

    void this.mail
      .sendNewClientMail({
        name: client.name,
        email: client.email,
        tempPassword,
        company: client.company ?? '',
        phone: client.phone ?? '',
      })
      .catch((error: unknown) => {
        this.logger.error(`Failed to resend invitation to ${client.email}`, error);
      });

    return { message: 'Invitation resent successfully' };
  }

  async deleteStaff(staffId: string, user: IAuthUser) {
    if (staffId === user.id) bad('You cannot delete your own account');

    const staff = await this.prisma.user.findFirst({
      where: { id: staffId, role: Role.STAFF },
      select: {
        id: true,
        projectDocuments: { select: { uploadId: true } },
        uploads: { select: { id: true } },
      },
    });

    if (!staff) bad('Staff user not found', 404);

    const uploadIdsToDelete = [
      ...new Set([
        ...staff.projectDocuments.map((d) => d.uploadId),
        ...staff.uploads.map((u) => u.id),
      ]),
    ];

    await this.prisma.$transaction(async (tx) => {
      await tx.user.delete({ where: { id: staffId } });
      if (uploadIdsToDelete.length) {
        await tx.upload.deleteMany({ where: { id: { in: uploadIdsToDelete } } });
      }
    });

    return { message: 'Staff deleted successfully' };
  }

  async deactivateStaff(staffId: string, user: IAuthUser) {
    const staff = await this.prisma.user.findFirst({
      where: {
        id: staffId,
        role: Role.STAFF,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!staff) bad('Staff user not found', 404);
    if (!staff.isActive) bad('Staff user is already deactivated');
    if (staffId === user.id) bad('You cannot deactivate your own account');

    await this.prisma.user.update({
      where: { id: staffId },
      data: { isActive: false },
    });

    return { message: 'Staff deactivated successfully' };
  }

  async reactivateStaff(staffId: string) {
    const staff = await this.prisma.user.findFirst({
      where: {
        id: staffId,
        role: Role.STAFF,
      },
      select: {
        id: true,
        isActive: true,
      },
    });

    if (!staff) bad('Staff user not found', 404);
    if (staff.isActive) bad('Staff user is already active');

    await this.prisma.user.update({
      where: { id: staffId },
      data: { isActive: true },
    });

    return { message: 'Staff reactivated successfully' };
  }
}
