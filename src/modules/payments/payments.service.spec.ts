import {
  PaymentMethod,
  Prisma,
  ProjectPaymentStatus,
  Role,
} from '@prisma/client';
import { PaymentsService } from './payments.service';

describe('PaymentsService', () => {
  function createPrismaMock() {
    return {
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
    };
  }

  function createStripeMock() {
    return {
      stripe: {
        checkout: {
          sessions: {
            create: jest.fn(),
          },
        },
      },
      constructEvent: jest.fn(),
    };
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
    const prisma = createPrismaMock();
    const stripe = createStripeMock();
    prisma.payment.findMany.mockResolvedValue([
      {
        id: 'payment-1',
        projectId: 'project-1',
        invoiceId: 'invoice-1',
        createdAt: new Date('2026-05-25T09:30:00.000Z'),
        method: PaymentMethod.STRIPE,
        reference: 'STRIPE-pi_abc123',
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

    const service = new PaymentsService(prisma as any, stripe as any);
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
        method: PaymentMethod.STRIPE,
        reference: 'STRIPE-pi_abc123',
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
    const prisma = createPrismaMock();
    const stripe = createStripeMock();
    const service = new PaymentsService(prisma as any, stripe as any);

    await expect(service.getPaymentList(nonAdminStaffUser)).rejects.toThrow(
      'Only administrators can view all payments',
    );
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });

  it('lists payments for a client across all client projects', async () => {
    const prisma = createPrismaMock();
    const stripe = createStripeMock();
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
        method: PaymentMethod.STRIPE,
        reference: 'STRIPE-pi_def456',
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
        method: PaymentMethod.STRIPE,
        reference: 'STRIPE-pi_abc123',
        amount: new Prisma.Decimal('1500'),
        project: {
          id: 'project-1',
          name: 'Kitchen Fit-Out',
          paymentStatus: ProjectPaymentStatus.PARTIALLY_PAID,
        },
      },
    ]);

    const service = new PaymentsService(prisma as any, stripe as any);
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
          method: PaymentMethod.STRIPE,
          reference: 'STRIPE-pi_def456',
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
          method: PaymentMethod.STRIPE,
          reference: 'STRIPE-pi_abc123',
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
    const prisma = createPrismaMock();
    const stripe = createStripeMock();
    prisma.user.findFirst.mockResolvedValue({
      id: 'client-1',
      name: 'Jane Client',
      email: 'jane.client@example.com',
      company: 'Jane Interiors',
      accountPartnerId: 'staff-1',
    });
    const service = new PaymentsService(prisma as any, stripe as any);

    await expect(
      service.getClientPayments('client-1', otherClientUser),
    ).rejects.toThrow('You can only view your own payments');
    expect(prisma.payment.findMany).not.toHaveBeenCalled();
  });
});
