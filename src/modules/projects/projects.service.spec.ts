import { ProjectStageType, ProjectStatus, Role } from '@prisma/client';
import { ProjectsService } from './projects.service';

describe('ProjectsService', () => {
  function createMailMock() {
    return {
      sendProjectCreatedMail: jest.fn().mockResolvedValue(undefined),
      sendProjectUpdatedMail: jest.fn().mockResolvedValue(undefined),
      sendProjectAttachmentMail: jest.fn().mockResolvedValue(undefined),
      sendProjectCommentMail: jest.fn().mockResolvedValue(undefined),
    };
  }

  function createPrismaMock() {
    return {
      user: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
      project: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      projectStage: {
        update: jest.fn(),
      },
      upload: {
        count: jest.fn(),
      },
      projectComment: {
        create: jest.fn(),
      },
      $transaction: jest.fn(),
    };
  }

  const staffUser = {
    id: 'staff-1',
    role: Role.STAFF,
    isAdmin: true,
  };

  const clientUser = {
    id: 'client-1',
    role: Role.CLIENT,
    isAdmin: false,
  };

  it('creates default stage rows when create-stage payloads are omitted', async () => {
    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue({
      id: 'client-1',
      name: 'Chris Rutlage',
      email: 'chris@example.com',
      accountPartnerId: 'staff-1',
    });
    prisma.project.create.mockResolvedValue({
      id: 'project-1',
      name: 'Kitchen Fit-Out',
      description: 'Custom kitchen cabinetry and finishing works.',
      location: 'Lekki, Lagos',
      fabrication: 12,
      status: ProjectStatus.PENDING,
      startDate: new Date('2026-05-23T00:00:00.000Z'),
      endDate: new Date('2026-06-30T00:00:00.000Z'),
      stages: [
        { stage: ProjectStageType.MIL },
        { stage: ProjectStageType.BUILD_ASSEMBLE },
        { stage: ProjectStageType.FINISHING },
        { stage: ProjectStageType.DELIVERY },
        { stage: ProjectStageType.INSTALL },
      ],
    });

    const mail = createMailMock();
    const service = new ProjectsService(prisma as any, mail as any);

    await service.createProject(
      {
        clientId: 'client-1',
        name: 'Kitchen Fit-Out',
        description: 'Custom kitchen cabinetry and finishing works.',
        location: 'Lekki, Lagos',
        fabrication: 12,
        startDate: '2026-05-23T00:00:00.000Z',
        endDate: '2026-06-30T00:00:00.000Z',
      },
      staffUser,
    );

    expect(prisma.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          stages: {
            create: [
              {
                stage: ProjectStageType.MIL,
                hoursBudgeted: 0,
                hoursSpent: 0,
                progress: 0,
                startDate: new Date('2026-05-23T00:00:00.000Z'),
              },
              {
                stage: ProjectStageType.BUILD_ASSEMBLE,
                hoursBudgeted: 0,
                hoursSpent: 0,
                progress: 0,
                startDate: new Date('2026-05-23T00:00:00.000Z'),
              },
              {
                stage: ProjectStageType.FINISHING,
                hoursBudgeted: 0,
                hoursSpent: 0,
                progress: 0,
                startDate: new Date('2026-05-23T00:00:00.000Z'),
              },
              {
                stage: ProjectStageType.DELIVERY,
                hoursBudgeted: 0,
                hoursSpent: 0,
                progress: 0,
                startDate: new Date('2026-05-23T00:00:00.000Z'),
              },
              {
                stage: ProjectStageType.INSTALL,
                hoursBudgeted: 0,
                hoursSpent: 0,
                progress: 0,
                startDate: new Date('2026-05-23T00:00:00.000Z'),
              },
            ],
          },
        }),
      }),
    );
    expect(mail.sendProjectCreatedMail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'chris@example.com',
        projectName: 'Kitchen Fit-Out',
      }),
    );
  });

  it('notifies the client when staff edits a project', async () => {
    const prisma = createPrismaMock();
    prisma.project.findUnique
      .mockResolvedValueOnce({
        id: 'project-1',
        status: ProjectStatus.IN_PRODUCTION,
        startDate: new Date('2026-05-23T00:00:00.000Z'),
        endDate: new Date('2026-06-30T00:00:00.000Z'),
        client: {
          accountPartnerId: 'staff-1',
          name: 'Chris Rutlage',
          email: 'chris@example.com',
        },
      })
      .mockResolvedValueOnce({
        id: 'project-1',
        name: 'Kitchen Fit-Out',
        description: 'Custom kitchen cabinetry and finishing works.',
        location: 'Lekki, Lagos',
        fabrication: 12,
        status: ProjectStatus.COMPLETED,
        startDate: new Date('2026-05-23T00:00:00.000Z'),
        endDate: new Date('2026-06-30T00:00:00.000Z'),
        client: {
          id: 'client-1',
          name: 'Chris Rutlage',
          email: 'chris@example.com',
        },
      });
    prisma.project.update.mockResolvedValue({});
    prisma.projectStage.update.mockResolvedValue({});
    prisma.$transaction.mockResolvedValue([]);

    const mail = createMailMock();
    const service = new ProjectsService(prisma as any, mail as any);

    await service.updateProjectStatus(
      'project-1',
      {
        status: ProjectStatus.COMPLETED,
        mil: {
          progress: 100,
          hoursSpent: 18,
        },
      },
      staffUser,
    );

    expect(mail.sendProjectUpdatedMail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'chris@example.com',
        recipientName: 'Chris Rutlage',
        projectName: 'Kitchen Fit-Out',
        projectStatus: 'Completed',
        updatedSummary: 'Project status, MIL stage',
      }),
    );
  });

  it('notifies the client when staff attaches documents to a project', async () => {
    const prisma = createPrismaMock();
    prisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Kitchen Fit-Out',
      clientId: 'client-1',
      attachmentId: null,
      client: {
        id: 'client-1',
        name: 'Chris Rutlage',
        email: 'chris@example.com',
        accountPartnerId: 'staff-1',
        accountPartner: {
          id: 'staff-1',
          name: 'Pat Partner',
          email: 'partner@example.com',
        },
      },
    });
    prisma.upload.count.mockResolvedValue(2);
    prisma.project.update.mockResolvedValue({
      id: 'project-1',
      name: 'Kitchen Fit-Out',
      client: {
        id: 'client-1',
        name: 'Chris Rutlage',
        email: 'chris@example.com',
      },
      attachment: {
        uploads: [{ name: 'invoice.pdf' }, { name: 'drawing.dwg' }],
      },
    });

    const mail = createMailMock();
    const service = new ProjectsService(prisma as any, mail as any);

    await service.updateProjectAttachment(
      'project-1',
      {
        attachment: {
          uploadIds: ['upload-1', 'upload-2'],
        },
      },
      staffUser,
    );

    expect(mail.sendProjectAttachmentMail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'chris@example.com',
        projectName: 'Kitchen Fit-Out',
        documentNames: 'invoice.pdf, drawing.dwg',
      }),
    );
  });

  it('notifies the account partner and admins when a client attaches documents', async () => {
    const prisma = createPrismaMock();
    prisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Kitchen Fit-Out',
      clientId: 'client-1',
      attachmentId: null,
      client: {
        id: 'client-1',
        name: 'Chris Rutlage',
        email: 'chris@example.com',
        accountPartnerId: 'staff-1',
        accountPartner: {
          id: 'staff-1',
          name: 'Pat Partner',
          email: 'partner@example.com',
        },
      },
    });
    prisma.upload.count.mockResolvedValue(1);
    prisma.project.update.mockResolvedValue({
      id: 'project-1',
      name: 'Kitchen Fit-Out',
      client: {
        id: 'client-1',
        name: 'Chris Rutlage',
        email: 'chris@example.com',
      },
      attachment: {
        uploads: [{ name: 'client-note.pdf' }],
      },
    });
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'admin-1',
        name: 'Ada Admin',
        email: 'admin@example.com',
      },
    ]);

    const mail = createMailMock();
    const service = new ProjectsService(prisma as any, mail as any);

    await service.updateProjectAttachment(
      'project-1',
      {
        attachment: {
          uploadIds: ['upload-1'],
        },
      },
      clientUser,
    );

    expect(mail.sendProjectAttachmentMail).toHaveBeenCalledTimes(2);
    expect(mail.sendProjectAttachmentMail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'partner@example.com',
      }),
    );
    expect(mail.sendProjectAttachmentMail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'admin@example.com',
      }),
    );
  });

  it('notifies the client when staff comments on a project', async () => {
    const prisma = createPrismaMock();
    prisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Kitchen Fit-Out',
      clientId: 'client-1',
      client: {
        id: 'client-1',
        name: 'Chris Rutlage',
        email: 'chris@example.com',
        accountPartnerId: 'staff-1',
        accountPartner: {
          id: 'staff-1',
          name: 'Pat Partner',
          email: 'partner@example.com',
        },
      },
    });
    prisma.projectComment.create.mockResolvedValue({
      id: 'comment-1',
      message: 'We have uploaded the latest drawing set.',
      createdAt: new Date('2026-06-04T10:00:00.000Z'),
      user: {
        id: 'staff-1',
        name: 'Pat Partner',
        role: Role.STAFF,
      },
    });

    const mail = createMailMock();
    const service = new ProjectsService(prisma as any, mail as any);

    await service.createProjectComment(
      {
        projectId: 'project-1',
        message: 'We have uploaded the latest drawing set.',
      },
      staffUser,
    );

    expect(mail.sendProjectCommentMail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'chris@example.com',
        commenterRole: Role.STAFF,
      }),
    );
  });

  it('notifies the account partner and admins when a client comments on a project', async () => {
    const prisma = createPrismaMock();
    prisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Kitchen Fit-Out',
      clientId: 'client-1',
      client: {
        id: 'client-1',
        name: 'Chris Rutlage',
        email: 'chris@example.com',
        accountPartnerId: 'staff-1',
        accountPartner: {
          id: 'staff-1',
          name: 'Pat Partner',
          email: 'partner@example.com',
        },
      },
    });
    prisma.projectComment.create.mockResolvedValue({
      id: 'comment-1',
      message: 'Please review the updated delivery note.',
      createdAt: new Date('2026-06-04T10:00:00.000Z'),
      user: {
        id: 'client-1',
        name: 'Chris Rutlage',
        role: Role.CLIENT,
      },
    });
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'admin-1',
        name: 'Ada Admin',
        email: 'admin@example.com',
      },
    ]);

    const mail = createMailMock();
    const service = new ProjectsService(prisma as any, mail as any);

    await service.createProjectComment(
      {
        projectId: 'project-1',
        message: 'Please review the updated delivery note.',
      },
      clientUser,
    );

    expect(mail.sendProjectCommentMail).toHaveBeenCalledTimes(2);
    expect(mail.sendProjectCommentMail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'partner@example.com',
        commenterRole: Role.CLIENT,
      }),
    );
    expect(mail.sendProjectCommentMail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'admin@example.com',
        commenterRole: Role.CLIENT,
      }),
    );
  });
});
