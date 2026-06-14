import {
  PaymentMethod,
  Prisma,
  ProjectPaymentStatus,
  QuoteStatus,
  Role,
} from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  function createPrismaMock() {
    const tx = {
      payment: {
        findFirst: jest.fn(),
        aggregate: jest.fn(),
        create: jest.fn(),
      },
      invoice: {
        aggregate: jest.fn(),
      },
      project: {
        update: jest.fn(),
      },
    };

    const prisma = {
      user: {
        findFirst: jest.fn(),
      },
      invoice: {
        findUnique: jest.fn(),
      },
      project: {
        findUnique: jest.fn(),
      },
      payment: {
        aggregate: jest.fn(),
        findMany: jest.fn(),
      },
      $transaction: jest.fn(async (callback: any) => callback(tx)),
    };

    return { prisma, tx };
  }

  const staffUser = {
    id: 'staff-1',
    role: Role.STAFF,
    isAdmin: true,
  };

  const nonAdminStaffUser = {
    id: 'staff-2',
    role: Role.STAFF,
    isAdmin: false,
  };

  const clientUser = {
    id: 'client-1',
    role: Role.CLIENT,
    isAdmin: false,
  };

  const otherClientUser = {
    id: 'client-2',
    role: Role.CLIENT,
    isAdmin: false,
  };

  it('lists all payments for administrators', async () => {
    const { prisma } = createPrismaMock();
    prisma.payment.findMany.mockResolvedValue([
      {
        id: 'payment-1',
        projectId: 'project-1',
        invoiceId: 'invoice-1',
        createdAt: new Date('2026-05-25T09:30:00.000Z'),
        method: PaymentMethod.WIRE,
        reference: 'WIRE-23456789',
        amount: new Prisma.Decimal('1500'),
        project: {
          id: 'project-1',
          name: 'Kitchen Fit-Out',
          paymentStatus: ProjectPaymentStatus.PARTIALLY_PAID,
          client: {
            id: 'client-1',
            name: 'Jane Client',
            email: 'jane.client@example.com',
            company: 'Jane Interiors',
          },
        },
      },
    ]);

    const service = new PaymentsService(prisma as any);
    const result = await service.getPaymentList(staffUser);

    expect(prisma.payment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: {
          createdAt: 'desc',
        },
      }),
    );
    expect(result).toEqual([
      {
        id: 'payment-1',
        projectId: 'project-1',
        invoiceId: 'invoice-1',
        createdAt: '2026-05-25T09:30:00.000Z',
        method: PaymentMethod.WIRE,
        reference: 'WIRE-23456789',
        amount: '1500',
        project: {
          id: 'project-1',
          name: 'Kitchen Fit-Out',
          paymentStatus: ProjectPaymentStatus.PARTIALLY_PAID,
          client: {
            id: 'client-1',
            name: 'Jane Client',
            email: 'jane.client@example.com',
            company: 'Jane Interiors',
          },
        },
      },
    ]);
  });

  it('rejects payment list access for non-admin staff', async () => {
    const { prisma } = createPrismaMock();
    const service = new PaymentsService(prisma as any);

    await expect(service.getPaymentList(nonAdminStaffUser)).rejects.toThrow(
      'Only administrators can view all payments',
    );
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });

  it('lists payments for a client across all client projects', async () => {
    const { prisma } = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue({
      id: 'client-1',
      name: 'Jane Client',
      email: 'jane.client@example.com',
      company: 'Jane Interiors',
      accountPartnerId: 'staff-1',
    });
    prisma.payment.aggregate.mockResolvedValue({
      _sum: {
        amount: new Prisma.Decimal('4500'),
      },
    });
    prisma.payment.findMany.mockResolvedValue([
      {
        id: 'payment-2',
        projectId: 'project-2',
        invoiceId: 'invoice-2',
        createdAt: new Date('2026-05-26T09:30:00.000Z'),
        method: PaymentMethod.ACH,
        reference: 'ACH-20260526093000000',
        amount: new Prisma.Decimal('3000'),
        project: {
          id: 'project-2',
          name: 'Bedroom Remodel',
          paymentStatus: ProjectPaymentStatus.PAID,
        },
      },
      {
        id: 'payment-1',
        projectId: 'project-1',
        invoiceId: 'invoice-1',
        createdAt: new Date('2026-05-25T09:30:00.000Z'),
        method: PaymentMethod.WIRE,
        reference: 'WIRE-23456789',
        amount: new Prisma.Decimal('1500'),
        project: {
          id: 'project-1',
          name: 'Kitchen Fit-Out',
          paymentStatus: ProjectPaymentStatus.PARTIALLY_PAID,
        },
      },
    ]);

    const service = new PaymentsService(prisma as any);
    const result = await service.getClientPayments('client-1', clientUser);

    expect(prisma.payment.aggregate).toHaveBeenCalledWith({
      where: {
        project: {
          clientId: 'client-1',
        },
      },
      _sum: {
        amount: true,
      },
    });
    expect(result).toEqual({
      client: {
        id: 'client-1',
        name: 'Jane Client',
        email: 'jane.client@example.com',
        company: 'Jane Interiors',
      },
      amountPaid: '4500',
      payments: [
        {
          id: 'payment-2',
          projectId: 'project-2',
          invoiceId: 'invoice-2',
          createdAt: '2026-05-26T09:30:00.000Z',
          method: PaymentMethod.ACH,
          reference: 'ACH-20260526093000000',
          amount: '3000',
          project: {
            id: 'project-2',
            name: 'Bedroom Remodel',
            paymentStatus: ProjectPaymentStatus.PAID,
          },
        },
        {
          id: 'payment-1',
          projectId: 'project-1',
          invoiceId: 'invoice-1',
          createdAt: '2026-05-25T09:30:00.000Z',
          method: PaymentMethod.WIRE,
          reference: 'WIRE-23456789',
          amount: '1500',
          project: {
            id: 'project-1',
            name: 'Kitchen Fit-Out',
            paymentStatus: ProjectPaymentStatus.PARTIALLY_PAID,
          },
        },
      ],
    });
  });

  it('rejects client payment access for another client user', async () => {
    const { prisma } = createPrismaMock();
    prisma.user.findFirst.mockResolvedValue({
      id: 'client-1',
      name: 'Jane Client',
      email: 'jane.client@example.com',
      company: 'Jane Interiors',
      accountPartnerId: 'staff-1',
    });
    const service = new PaymentsService(prisma as any);

    await expect(
      service.getClientPayments('client-1', otherClientUser),
    ).rejects.toThrow('You can only view your own payments');
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });

  it('records a partial payment and moves the project to PARTIALLY_PAID', async () => {
    const { prisma, tx } = createPrismaMock();
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'invoice-1',
      projectId: 'project-1',
      status: QuoteStatus.APPROVED,
      total: new Prisma.Decimal('7000'),
      project: {
        client: {
          accountPartnerId: 'staff-1',
        },
      },
    });
    tx.payment.findFirst.mockResolvedValue(null);
    tx.payment.aggregate
      .mockResolvedValueOnce({
        _sum: {
          amount: new Prisma.Decimal('3000'),
        },
      })
      .mockResolvedValueOnce({
        _sum: {
          amount: new Prisma.Decimal('4500'),
        },
      });
    tx.invoice.aggregate.mockResolvedValue({
      _sum: {
        total: new Prisma.Decimal('7000'),
      },
    });
    tx.payment.create.mockResolvedValue({
      id: 'payment-1',
      projectId: 'project-1',
      invoiceId: 'invoice-1',
      createdAt: new Date('2026-05-25T09:30:00.000Z'),
      method: PaymentMethod.WIRE,
      reference: 'WIRE-23456789',
      amount: new Prisma.Decimal('1500'),
    });

    const service = new PaymentsService(prisma as any);
    const result = await service.createPayment(
      {
        createdAt: '2026-05-25T09:30:00.000Z',
        invoiceId: 'invoice-1',
        method: PaymentMethod.WIRE,
        reference: 'WIRE-23456789',
        amount: 1500,
      },
      staffUser,
    );

    expect(tx.project.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: {
        paymentStatus: ProjectPaymentStatus.PARTIALLY_PAID,
      },
    });
    expect(result).toMatchObject({
      message: 'Payment recorded successfully',
      paymentStatus: ProjectPaymentStatus.PARTIALLY_PAID,
      amountPaid: '4500',
      amountDue: '2500',
      payment: {
        invoiceId: 'invoice-1',
        reference: 'WIRE-23456789',
        amount: '1500',
      },
    });
  });

  it('records a final payment and moves the project to PAID', async () => {
    const { prisma, tx } = createPrismaMock();
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'invoice-2',
      projectId: 'project-1',
      status: QuoteStatus.APPROVED,
      total: new Prisma.Decimal('4500'),
      project: {
        client: {
          accountPartnerId: 'staff-1',
        },
      },
    });
    tx.payment.findFirst.mockResolvedValue(null);
    tx.payment.aggregate
      .mockResolvedValueOnce({
        _sum: {
          amount: new Prisma.Decimal('3000'),
        },
      })
      .mockResolvedValueOnce({
        _sum: {
          amount: new Prisma.Decimal('4500'),
        },
      });
    tx.invoice.aggregate.mockResolvedValue({
      _sum: {
        total: new Prisma.Decimal('4500'),
      },
    });
    tx.payment.create.mockResolvedValue({
      id: 'payment-2',
      projectId: 'project-1',
      invoiceId: 'invoice-2',
      createdAt: new Date('2026-05-25T09:30:00.123Z'),
      method: PaymentMethod.ACH,
      reference: 'ACH-20260525093000123',
      amount: new Prisma.Decimal('1500'),
    });

    const service = new PaymentsService(prisma as any);
    const result = await service.createPayment(
      {
        createdAt: '2026-05-25T09:30:00.123Z',
        invoiceId: 'invoice-2',
        method: PaymentMethod.ACH,
        amount: 1500,
      },
      staffUser,
    );

    expect(tx.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          reference: 'ACH-20260525093000123',
        }),
      }),
    );
    expect(result).toMatchObject({
      paymentStatus: ProjectPaymentStatus.PAID,
      amountPaid: '4500',
      amountDue: '0',
      payment: {
        invoiceId: 'invoice-2',
        reference: 'ACH-20260525093000123',
      },
    });
  });

  it('rejects payments that exceed the remaining invoice balance', async () => {
    const { prisma, tx } = createPrismaMock();
    prisma.invoice.findUnique.mockResolvedValue({
      id: 'invoice-3',
      projectId: 'project-1',
      status: QuoteStatus.APPROVED,
      total: new Prisma.Decimal('4500'),
      project: {
        client: {
          accountPartnerId: 'staff-1',
        },
      },
    });
    tx.payment.findFirst.mockResolvedValue(null);
    tx.payment.aggregate.mockResolvedValue({
      _sum: {
        amount: new Prisma.Decimal('4000'),
      },
    });

    const service = new PaymentsService(prisma as any);

    await expect(
      service.createPayment(
        {
          createdAt: '2026-05-25T09:30:00.000Z',
          invoiceId: 'invoice-3',
          method: PaymentMethod.CHECK,
          reference: 'CHK-234567',
          amount: 600,
        },
        staffUser,
      ),
    ).rejects.toThrow('Payment amount exceeds the remaining invoice balance');
  });
});
