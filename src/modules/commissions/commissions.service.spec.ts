import { CommissionStatus, Prisma, Role } from '@prisma/client';
import { CommissionsService } from './commissions.service';

describe('CommissionsService', () => {
  function createPrismaMock() {
    return {
      user: {
        findFirst: jest.fn(),
      },
      commission: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };
  }

  const adminUser = {
    id: 'admin-1',
    role: Role.STAFF,
    isAdmin: true,
  };

  const staffUser = {
    id: 'staff-1',
    role: Role.STAFF,
    isAdmin: false,
  };

  function createCommissionRecord(
    overrides: Partial<{
      id: string;
      total: Prisma.Decimal;
      percentageCommission: Prisma.Decimal;
      amount: Prisma.Decimal;
      status: CommissionStatus;
      paidAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      staff: {
        id: string;
        name: string;
        email: string;
      };
      client: {
        id: string;
        name: string;
        email: string;
        company: string | null;
      };
      quote: {
        id: string;
        quoteId: string;
        name: string;
        total: Prisma.Decimal;
        taxAmount: Prisma.Decimal;
        project: {
          id: string;
          name: string;
        };
      };
    }> = {},
  ) {
    return {
      id: 'commission-1',
      total: new Prisma.Decimal('4200'),
      percentageCommission: new Prisma.Decimal('0'),
      amount: new Prisma.Decimal('0'),
      status: CommissionStatus.QUOTED_COMMISSION,
      paidAt: null,
      createdAt: new Date('2026-06-06T12:00:00.000Z'),
      updatedAt: new Date('2026-06-06T12:15:00.000Z'),
      staff: {
        id: 'staff-1',
        name: 'Pat Partner',
        email: 'partner@example.com',
      },
      client: {
        id: 'client-1',
        name: 'Chris Rutlage',
        email: 'chris@example.com',
        company: 'Rutlage Energy',
      },
      quote: {
        id: 'quote-1',
        quoteId: 'QOT-20260525-001',
        name: 'Solar Panel Installation',
        total: new Prisma.Decimal('4289'),
        taxAmount: new Prisma.Decimal('89'),
        project: {
          id: 'project-1',
          name: 'Solar Site Buildout',
        },
      },
      ...overrides,
    };
  }

  it('lists all commissions for administrators', async () => {
    const prisma = createPrismaMock();
    prisma.commission.findMany.mockResolvedValue([createCommissionRecord()]);

    const service = new CommissionsService(prisma as any);
    const result = await service.getCommissionList(adminUser);

    expect(prisma.commission.findMany).toHaveBeenCalledWith({
      orderBy: {
        createdAt: 'desc',
      },
      select: expect.any(Object),
    });
    expect(result).toEqual([
      expect.objectContaining({
        id: 'commission-1',
        total: '4200',
        percentageCommission: '0',
        amount: '0',
        status: CommissionStatus.QUOTED_COMMISSION,
        client: expect.objectContaining({
          id: 'client-1',
        }),
      }),
    ]);
  });

  it('lets staff fetch only their own commissions', async () => {
    const prisma = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue({
      id: 'staff-1',
    });
    prisma.commission.findMany.mockResolvedValue([createCommissionRecord()]);

    const service = new CommissionsService(prisma as any);
    const result = await service.getMyCommissionList(staffUser);

    expect(prisma.commission.findMany).toHaveBeenCalledWith({
      where: {
        staffId: 'staff-1',
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: expect.any(Object),
    });
    expect(result).toHaveLength(1);
  });

  it('rejects a staff user trying to fetch another staff user commissions', async () => {
    const prisma = createPrismaMock();
    const service = new CommissionsService(prisma as any);

    await expect(
      service.getStaffCommissionList('staff-2', staffUser),
    ).rejects.toThrow('You can only view your own commissions');
    expect(prisma.user.findFirst).not.toHaveBeenCalled();
  });

  it('updates a commission percentage for administrators', async () => {
    const prisma = createPrismaMock();
    prisma.commission.findUnique.mockResolvedValue({
      id: 'commission-1',
      total: new Prisma.Decimal('4200'),
      status: CommissionStatus.APPROVED_COMMISSION,
    });
    prisma.commission.update.mockResolvedValue(
      createCommissionRecord({
        percentageCommission: new Prisma.Decimal('7.5'),
        amount: new Prisma.Decimal('315'),
        status: CommissionStatus.APPROVED_COMMISSION,
      }),
    );

    const service = new CommissionsService(prisma as any);
    const result = await service.updateCommission(
      'commission-1',
      {
        percentageCommission: 7.5,
      },
      adminUser,
    );

    expect(prisma.commission.update).toHaveBeenCalledWith({
      where: { id: 'commission-1' },
      data: {
        percentageCommission: expect.any(Prisma.Decimal),
        amount: expect.any(Prisma.Decimal),
      },
      select: expect.any(Object),
    });
    expect(result).toMatchObject({
      message: 'Commission updated successfully',
      commission: expect.objectContaining({
        percentageCommission: '7.5',
        amount: '315',
      }),
    });
  });

  it('marks an approved commission as paid for administrators', async () => {
    const prisma = createPrismaMock();
    prisma.commission.findUnique.mockResolvedValue({
      id: 'commission-1',
      total: new Prisma.Decimal('4200'),
      status: CommissionStatus.APPROVED_COMMISSION,
    });
    prisma.commission.update.mockResolvedValue(
      createCommissionRecord({
        percentageCommission: new Prisma.Decimal('7.5'),
        amount: new Prisma.Decimal('315'),
        status: CommissionStatus.PAID,
        paidAt: new Date('2026-06-06T14:20:00.000Z'),
      }),
    );

    const service = new CommissionsService(prisma as any);
    const result = await service.updateCommission(
      'commission-1',
      {
        status: CommissionStatus.PAID,
      },
      adminUser,
    );

    expect(prisma.commission.update).toHaveBeenCalledWith({
      where: { id: 'commission-1' },
      data: {
        status: CommissionStatus.PAID,
        paidAt: expect.any(Date),
      },
      select: expect.any(Object),
    });
    expect(result).toMatchObject({
      message: 'Commission updated successfully',
      commission: expect.objectContaining({
        status: CommissionStatus.PAID,
        paidAt: '2026-06-06T14:20:00.000Z',
      }),
    });
  });

  it('rejects marking a quoted commission as paid', async () => {
    const prisma = createPrismaMock();
    prisma.commission.findUnique.mockResolvedValue({
      id: 'commission-1',
      total: new Prisma.Decimal('4200'),
      status: CommissionStatus.QUOTED_COMMISSION,
    });

    const service = new CommissionsService(prisma as any);

    await expect(
      service.updateCommission(
        'commission-1',
        {
          status: CommissionStatus.PAID,
        },
        adminUser,
      ),
    ).rejects.toThrow('Only approved commissions can be marked as paid');
    expect(prisma.commission.update).not.toHaveBeenCalled();
  });
});
