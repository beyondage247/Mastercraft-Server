import {
  CommissionStatus,
  Prisma,
  ProjectPaymentStatus,
  ProjectStatus,
  QuotePaymentScheduleAmountType,
  QuotePaymentScheduleDateType,
  QuotePaymentScheduleItemType,
  QuotePaymentScheduleType,
  QuoteStatus,
  Role,
} from '@prisma/client';
import { QuotesService } from './quotes.service';

describe('QuotesService', () => {
  function createMailMock() {
    return {
      sendQuoteCreatedMail: jest.fn().mockResolvedValue(undefined),
      sendInvoiceCreatedMail: jest.fn().mockResolvedValue(undefined),
    };
  }

  function createPdfMock() {
    return {
      generateQuotePdf: jest.fn().mockResolvedValue(Buffer.from('quote-pdf')),
      generateInvoicePdf: jest
        .fn()
        .mockResolvedValue(Buffer.from('invoice-pdf')),
    };
  }

  function createJwtMock() {
    return {
      sign: jest.fn().mockReturnValue('signed-download-token'),
      verifyAsync: jest.fn(),
    };
  }

  function createPrismaMock() {
    const tx = {
      quote: {
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      invoice: {
        create: jest.fn(),
        aggregate: jest.fn(),
        findFirst: jest.fn(),
      },
      payment: {
        aggregate: jest.fn(),
      },
      commission: {
        create: jest.fn(),
        upsert: jest.fn(),
      },
      project: {
        update: jest.fn(),
      },
    };

    const prisma = {
      user: {
        findMany: jest.fn(),
      },
      project: {
        findUnique: jest.fn(),
      },
      quote: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      invoice: {
        findFirst: jest.fn(),
      },
      catalogItem: {
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

  const clientUser = {
    id: 'client-1',
    role: Role.CLIENT,
    isAdmin: false,
  };

  function createScheduleItem(
    overrides: Partial<{
      itemType: QuotePaymentScheduleItemType;
      name: string;
      amountType: QuotePaymentScheduleAmountType | null;
      percentage: Prisma.Decimal;
      amount: Prisma.Decimal;
      dateType: QuotePaymentScheduleDateType;
      dueDate: Date | null;
      position: number;
    }> = {},
  ) {
    return {
      itemType: QuotePaymentScheduleItemType.FULL_PAYMENT,
      name: 'Full Payment',
      amountType: null,
      percentage: new Prisma.Decimal('100'),
      amount: new Prisma.Decimal('4289'),
      dateType: QuotePaymentScheduleDateType.FIXED_DATE,
      dueDate: new Date('2026-06-30T00:00:00.000Z'),
      position: 0,
      ...overrides,
    };
  }

  it('creates a quote with a split balance schedule and moves the project to QUOTED', async () => {
    const { prisma, tx } = createPrismaMock();
    const quoteMessage =
      'Doors to be solid core Masonite Carrara unless otherwise specified.';
    prisma.project.findUnique.mockResolvedValue({
      id: 'project-1',
      name: 'Solar Site Buildout',
      location: 'Jeffersontown, Kentucky',
      status: ProjectStatus.PENDING,
      quote: null,
      client: {
        id: 'client-1',
        name: 'Chris Rutlage',
        email: 'chris@example.com',
        phone: '(502) 555-0100',
        company: 'Rutlage Energy',
        accountPartnerId: 'staff-1',
        accountPartner: {
          id: 'staff-1',
          name: 'Garrett',
          email: 'garrett@example.com',
        },
      },
    });
    tx.quote.findFirst.mockResolvedValue(null);
    prisma.catalogItem.findMany.mockResolvedValue([
      {
        id: 'service-1',
        productName: 'Solar Panel Installation',
        ourPrice: new Prisma.Decimal('4200'),
      },
    ]);
    tx.quote.create.mockResolvedValue({
      id: 'quote-1',
      name: 'Solar Panel Installation',
      quoteId: 'QT-2026-00001',
      status: QuoteStatus.PENDING,
      message: quoteMessage,
      clientComment: null,
      dateIssued: new Date('2026-05-17T00:00:00.000Z'),
      validUntil: new Date('2026-05-31T00:00:00.000Z'),
      subtotal: new Prisma.Decimal('4200'),
      tax: new Prisma.Decimal('8'),
      taxAmount: new Prisma.Decimal('89'),
      discount: new Prisma.Decimal('0'),
      shippingFee: new Prisma.Decimal('0'),
      total: new Prisma.Decimal('4289'),
      createdAt: new Date('2026-05-24T10:30:00.000Z'),
      updatedAt: new Date('2026-05-24T10:35:00.000Z'),
      project: {
        id: 'project-1',
        name: 'Solar Site Buildout',
        status: ProjectStatus.QUOTED,
        clientId: 'client-1',
      },
      lineItems: [
        {
          id: 'line-1',
          productName: 'Solar Panel Installation',
          ourPrice: new Prisma.Decimal('4200'),
          quantity: 2,
        },
      ],
      paymentSchedule: {
        type: QuotePaymentScheduleType.DEPOSIT_AND_SPLIT_BALANCE,
        totalAmount: new Prisma.Decimal('4289'),
        items: [
          createScheduleItem({
            itemType: QuotePaymentScheduleItemType.DEPOSIT,
            name: 'Deposit',
            amountType: QuotePaymentScheduleAmountType.PERCENTAGE,
            percentage: new Prisma.Decimal('20'),
            amount: new Prisma.Decimal('857.8'),
            dateType: QuotePaymentScheduleDateType.INVOICE_GENERATION,
            dueDate: null,
            position: 0,
          }),
          createScheduleItem({
            itemType: QuotePaymentScheduleItemType.SPLIT_PAYMENT,
            name: 'Payment 1',
            percentage: new Prisma.Decimal('50'),
            amount: new Prisma.Decimal('1715.6'),
            dueDate: new Date('2026-06-15T00:00:00.000Z'),
            position: 1,
          }),
          createScheduleItem({
            itemType: QuotePaymentScheduleItemType.SPLIT_PAYMENT,
            name: 'Payment 2',
            percentage: new Prisma.Decimal('50'),
            amount: new Prisma.Decimal('1715.6'),
            dueDate: new Date('2026-06-30T00:00:00.000Z'),
            position: 2,
          }),
        ],
      },
      invoices: [],
    });

    const mail = createMailMock();
    const service = new QuotesService(
      prisma as any,
      mail as any,
      createPdfMock() as any,
      createJwtMock() as any,
    );
    const result = await service.createQuote(
      {
        projectId: 'project-1',
        name: 'Solar Panel Installation',
        message: quoteMessage,
        dateIssued: 'May 17, 2026',
        validUntil: 'May 31, 2026',
        subtotal: 4200,
        tax: 8,
        taxAmount: 89,
        discount: 0,
        shippingFee: 0,
        total: 4289,
        lineItems: [{ serviceId: 'service-1', quantity: 2 }],
        paymentSchedule: {
          type: QuotePaymentScheduleType.DEPOSIT_AND_SPLIT_BALANCE,
          totalAmount: 4289,
          deposit: {
            name: 'Deposit',
            amountType: 'percentage',
            percentage: 20,
            amount: 857.8,
            date: 'Date of Invoice Generation',
          },
          balance: {
            amount: 3431.2,
            percentage: 80,
            split: true,
            payments: [
              {
                name: 'Payment 1',
                amount: 1715.6,
                percentage: 50,
                date: '2026/15/06',
              },
              {
                name: 'Payment 2',
                amount: 1715.6,
                percentage: 50,
                date: '2026/30/06',
              },
            ],
          },
        },
      },
      staffUser,
    );

    expect(tx.quote.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          message: quoteMessage,
          lineItems: {
            create: [
              {
                productName: 'Solar Panel Installation',
                ourPrice: new Prisma.Decimal('4200'),
                quantity: 2,
              },
            ],
          },
          paymentSchedule: {
            create: {
              type: QuotePaymentScheduleType.DEPOSIT_AND_SPLIT_BALANCE,
              totalAmount: new Prisma.Decimal('4289'),
              items: {
                create: [
                  expect.objectContaining({
                    itemType: QuotePaymentScheduleItemType.DEPOSIT,
                    amountType: QuotePaymentScheduleAmountType.PERCENTAGE,
                  }),
                  expect.objectContaining({
                    itemType: QuotePaymentScheduleItemType.SPLIT_PAYMENT,
                    name: 'Payment 1',
                  }),
                  expect.objectContaining({
                    itemType: QuotePaymentScheduleItemType.SPLIT_PAYMENT,
                    name: 'Payment 2',
                  }),
                ],
              },
            },
          },
        }),
      }),
    );
    expect(tx.project.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: { status: ProjectStatus.QUOTED },
    });
    expect(tx.commission.create).toHaveBeenCalledWith({
      data: {
        quoteId: 'quote-1',
        clientId: 'client-1',
        staffId: 'staff-1',
        total: new Prisma.Decimal('4200'),
        percentageCommission: new Prisma.Decimal('0'),
        amount: new Prisma.Decimal('0'),
        status: CommissionStatus.QUOTED_COMMISSION,
      },
    });
    expect(result.message).toBe('Quote created successfully');
    expect(result.quote.status).toBe(QuoteStatus.PENDING);
    expect(result.quote.message).toBe(quoteMessage);
    expect(result.quote.project.status).toBe(ProjectStatus.QUOTED);
    expect(result.quote.lineItems).toEqual([
      expect.objectContaining({
        quantity: 2,
        lineTotal: '8400',
      }),
    ]);
    expect(result.quote.paymentSchedule).toEqual({
      type: QuotePaymentScheduleType.DEPOSIT_AND_SPLIT_BALANCE,
      totalAmount: '4289',
      deposit: {
        name: 'Deposit',
        amountType: 'percentage',
        percentage: '20',
        amount: '857.8',
        date: 'Date of Invoice Generation',
      },
      balance: {
        amount: '3431.2',
        percentage: '80',
        split: true,
        payments: [
          {
            name: 'Payment 1',
            amount: '1715.6',
            percentage: '50',
            date: '2026-06-15T00:00:00.000Z',
          },
          {
            name: 'Payment 2',
            amount: '1715.6',
            percentage: '50',
            date: '2026-06-30T00:00:00.000Z',
          },
        ],
      },
    });
    expect(result.quote.discount).toBe('0');
    expect(result.quote.shippingFee).toBe('0');
    expect(mail.sendQuoteCreatedMail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'chris@example.com',
        recipientName: 'Chris Rutlage',
        quoteId: 'QT-2026-00001',
        projectLocation: 'Jeffersontown, Kentucky',
        clientCompany: 'Rutlage Energy',
        clientPhone: '(502) 555-0100',
        subtotal: '$4,200.00',
        taxLabel: 'Tax (8%)',
        taxAmount: '$89.00',
        showTax: true,
        showDiscount: false,
        showShippingFee: false,
        paymentScheduleLabel: 'Deposit and Split Balance',
        hasPaymentSchedule: true,
        contactName: 'Garrett',
        contactEmail: 'garrett@example.com',
        message: quoteMessage,
        lineItems: [
          {
            productName: 'Solar Panel Installation',
            quantity: 2,
            price: '$4,200.00',
            amount: '$8,400.00',
          },
        ],
        paymentScheduleItems: [
          {
            name: 'Deposit',
            dueDate: 'Date of Invoice Generation',
            percentage: '20%',
            amount: '$857.80',
          },
          {
            name: 'Payment 1',
            dueDate: 'June 15, 2026',
            percentage: '50%',
            amount: '$1,715.60',
          },
          {
            name: 'Payment 2',
            dueDate: 'June 30, 2026',
            percentage: '50%',
            amount: '$1,715.60',
          },
        ],
      }),
    );
  });

  it('creates a quote with a full payment schedule', async () => {
    const { prisma, tx } = createPrismaMock();
    prisma.project.findUnique.mockResolvedValue({
      id: 'project-2',
      name: 'Kitchen Fit-Out',
      status: ProjectStatus.PENDING,
      quote: null,
      client: {
        id: 'client-2',
        name: 'Jefferson Kent',
        email: 'jefferson@example.com',
        accountPartnerId: 'staff-1',
      },
    });
    tx.quote.findFirst.mockResolvedValue(null);
    prisma.catalogItem.findMany.mockResolvedValue([
      {
        id: 'service-2',
        productName: 'Cabinet Installation',
        ourPrice: new Prisma.Decimal('2000'),
      },
    ]);
    tx.quote.create.mockResolvedValue({
      id: 'quote-2',
      name: 'Kitchen Fit-Out Quote',
      quoteId: 'QT-2026-00002',
      status: QuoteStatus.PENDING,
      message: null,
      clientComment: null,
      dateIssued: new Date('2026-06-01T00:00:00.000Z'),
      validUntil: new Date('2026-06-15T00:00:00.000Z'),
      subtotal: new Prisma.Decimal('2000'),
      tax: new Prisma.Decimal('0'),
      taxAmount: new Prisma.Decimal('0'),
      discount: new Prisma.Decimal('125'),
      shippingFee: new Prisma.Decimal('50'),
      total: new Prisma.Decimal('2000'),
      createdAt: new Date('2026-06-01T08:30:00.000Z'),
      updatedAt: new Date('2026-06-01T08:30:00.000Z'),
      project: {
        id: 'project-2',
        name: 'Kitchen Fit-Out',
        status: ProjectStatus.QUOTED,
        clientId: 'client-2',
      },
      lineItems: [
        {
          id: 'line-2',
          productName: 'Cabinet Installation',
          ourPrice: new Prisma.Decimal('2000'),
          quantity: 1,
        },
      ],
      paymentSchedule: {
        type: QuotePaymentScheduleType.FULL_PAYMENT,
        totalAmount: new Prisma.Decimal('2000'),
        items: [
          createScheduleItem({
            amount: new Prisma.Decimal('2000'),
            dueDate: new Date('2026-06-30T00:00:00.000Z'),
          }),
        ],
      },
      invoices: [],
    });

    const mail = createMailMock();
    const service = new QuotesService(
      prisma as any,
      mail as any,
      createPdfMock() as any,
      createJwtMock() as any,
    );
    const result = await service.createQuote(
      {
        projectId: 'project-2',
        name: 'Kitchen Fit-Out Quote',
        dateIssued: '2026-06-01',
        validUntil: '2026-06-15',
        subtotal: 2000,
        tax: 0,
        taxAmount: 0,
        discount: 125,
        shippingFee: 50,
        total: 2000,
        lineItems: [{ serviceId: 'service-2', quantity: 1 }],
        paymentSchedule: {
          type: QuotePaymentScheduleType.FULL_PAYMENT,
          totalAmount: 2000,
          fullPayment: {
            name: 'Full Payment',
            amount: 2000,
            percentage: 100,
            date: '2026-06-30',
          },
        },
      },
      staffUser,
    );

    expect(result.quote.paymentSchedule).toEqual({
      type: QuotePaymentScheduleType.FULL_PAYMENT,
      totalAmount: '2000',
      fullPayment: {
        name: 'Full Payment',
        amount: '2000',
        percentage: '100',
        date: '2026-06-30T00:00:00.000Z',
      },
    });
    expect(result.quote.discount).toBe('125');
    expect(result.quote.shippingFee).toBe('50');
    expect(result.quote.message).toBeNull();
    expect(mail.sendQuoteCreatedMail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'jefferson@example.com',
        quoteId: 'QT-2026-00002',
      }),
    );
  });

  it('approves a quote and moves the project to IN_PRODUCTION', async () => {
    const { prisma, tx } = createPrismaMock();
    const quoteMessage =
      'Install base system first, then complete finish work.';
    prisma.quote.findFirst.mockResolvedValue({
      id: 'quote-1',
      name: 'Solar Panel Installation',
      quoteId: 'QT-2026-00001',
      projectId: 'project-1',
      status: QuoteStatus.PENDING,
      message: quoteMessage,
      dateIssued: new Date('2026-05-17T00:00:00.000Z'),
      validUntil: new Date('2026-05-31T00:00:00.000Z'),
      subtotal: new Prisma.Decimal('4200'),
      tax: new Prisma.Decimal('8'),
      taxAmount: new Prisma.Decimal('89'),
      discount: new Prisma.Decimal('150'),
      shippingFee: new Prisma.Decimal('75'),
      total: new Prisma.Decimal('4289'),
      project: {
        id: 'project-1',
        name: 'Solar Site Buildout',
        location: '5222 Indian Woods Drive',
        status: ProjectStatus.QUOTED,
        client: {
          id: 'client-1',
          name: 'Chris Rutlage',
          email: 'chris@example.com',
          phone: '(502) 555-0100',
          company: 'Rutlage Energy',
          additionalEmail: 'ops@rutlageenergy.com',
          accountPartnerId: 'staff-1',
          accountPartner: {
            id: 'staff-1',
            name: 'Pat Partner',
            email: 'partner@example.com',
          },
        },
      },
      commission: {
        staffId: 'staff-1',
        percentageCommission: new Prisma.Decimal('0'),
        status: CommissionStatus.QUOTED_COMMISSION,
      },
      lineItems: [
        {
          productName: 'Solar Panel Installation',
          ourPrice: new Prisma.Decimal('4200'),
          quantity: 2,
        },
      ],
    });
    tx.invoice.create.mockResolvedValue({
      id: 'invoice-1',
      invoiceId: 'INV-20260525-001',
    });
    tx.invoice.aggregate.mockResolvedValue({
      _sum: {
        total: new Prisma.Decimal('4289'),
      },
    });
    tx.payment.aggregate.mockResolvedValue({
      _sum: {
        amount: new Prisma.Decimal('0'),
      },
    });
    tx.quote.update.mockResolvedValue({
      id: 'quote-1',
      name: 'Solar Panel Installation',
      quoteId: 'QT-2026-00001',
      status: QuoteStatus.APPROVED,
      message: quoteMessage,
      clientComment: null,
      dateIssued: new Date('2026-05-17T00:00:00.000Z'),
      validUntil: new Date('2026-05-31T00:00:00.000Z'),
      subtotal: new Prisma.Decimal('4200'),
      tax: new Prisma.Decimal('8'),
      taxAmount: new Prisma.Decimal('89'),
      discount: new Prisma.Decimal('150'),
      shippingFee: new Prisma.Decimal('75'),
      total: new Prisma.Decimal('4289'),
      createdAt: new Date('2026-05-24T10:30:00.000Z'),
      updatedAt: new Date('2026-05-25T08:00:00.000Z'),
      project: {
        id: 'project-1',
        name: 'Solar Site Buildout',
        status: ProjectStatus.IN_PRODUCTION,
        clientId: 'client-1',
      },
      lineItems: [],
      paymentSchedule: {
        type: QuotePaymentScheduleType.FULL_PAYMENT,
        totalAmount: new Prisma.Decimal('4289'),
        items: [
          createScheduleItem({
            amount: new Prisma.Decimal('4289'),
          }),
        ],
      },
      invoices: [
        {
          id: 'invoice-1',
          invoiceId: 'INV-20260525-001',
          status: QuoteStatus.APPROVED,
          total: new Prisma.Decimal('4289'),
          createdAt: new Date('2026-05-25T08:00:00.000Z'),
          payments: [],
        },
      ],
    });
    prisma.user.findMany.mockResolvedValue([
      {
        id: 'admin-1',
        name: 'Ada Admin',
        email: 'admin@example.com',
      },
    ]);

    const mail = createMailMock();
    const service = new QuotesService(
      prisma as any,
      mail as any,
      createPdfMock() as any,
      createJwtMock() as any,
    );
    const result = await service.respondToQuote(
      'quote-1',
      {
        status: QuoteStatus.APPROVED,
      },
      clientUser,
    );

    expect(tx.project.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: {
        status: ProjectStatus.IN_PRODUCTION,
        paymentStatus: ProjectPaymentStatus.UNPAID,
      },
    });
    expect(tx.invoice.create).toHaveBeenCalledWith({
      data: {
        invoiceId: expect.stringMatching(/^INV-\d{8}-\d{3}$/),
        quoteId: 'quote-1',
        projectId: 'project-1',
        name: 'Solar Panel Installation',
        status: QuoteStatus.APPROVED,
        message: quoteMessage,
        clientComment: null,
        dateIssued: new Date('2026-05-17T00:00:00.000Z'),
        validUntil: new Date('2026-05-31T00:00:00.000Z'),
        subtotal: new Prisma.Decimal('4200'),
        tax: new Prisma.Decimal('8'),
        taxAmount: new Prisma.Decimal('89'),
        discount: new Prisma.Decimal('150'),
        shippingFee: new Prisma.Decimal('75'),
        total: new Prisma.Decimal('4289'),
        lineItems: {
          create: [
            {
              productName: 'Solar Panel Installation',
              ourPrice: new Prisma.Decimal('4200'),
              quantity: 2,
            },
          ],
        },
      },
    });
    expect(tx.commission.upsert).toHaveBeenCalledWith({
      where: {
        quoteId: 'quote-1',
      },
      create: {
        quoteId: 'quote-1',
        clientId: 'client-1',
        staffId: 'staff-1',
        total: new Prisma.Decimal('4200'),
        percentageCommission: new Prisma.Decimal('0'),
        amount: new Prisma.Decimal('0'),
        status: CommissionStatus.APPROVED_COMMISSION,
      },
      update: {
        clientId: 'client-1',
        staffId: 'staff-1',
        total: new Prisma.Decimal('4200'),
        amount: new Prisma.Decimal('0'),
        status: CommissionStatus.APPROVED_COMMISSION,
      },
    });
    expect(result.quote.status).toBe(QuoteStatus.APPROVED);
    expect(result.quote.message).toBe(quoteMessage);
    expect(mail.sendInvoiceCreatedMail).toHaveBeenCalledTimes(3);
    expect(mail.sendInvoiceCreatedMail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'chris@example.com',
        invoiceId: 'INV-20260525-001',
        message: quoteMessage,
        customerName: 'Chris Rutlage',
        customerEmail: 'chris@example.com',
        additionalRecipientEmail: 'ops@rutlageenergy.com',
        clientCompany: 'Rutlage Energy',
        clientPhone: '(502) 555-0100',
        projectLocation: '5222 Indian Woods Drive',
        subtotal: '$4,200.00',
        taxLabel: 'Tax (8%)',
        taxAmount: '$89.00',
        showTax: true,
        discount: '$150.00',
        showDiscount: true,
        shippingFee: '$75.00',
        showShippingFee: true,
        contactName: 'Pat Partner',
        contactEmail: 'partner@example.com',
        lineItems: [
          {
            productName: 'Solar Panel Installation',
            quantity: 2,
            price: '$4,200.00',
            amount: '$8,400.00',
          },
        ],
      }),
    );
    expect(mail.sendInvoiceCreatedMail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'partner@example.com',
        invoiceId: 'INV-20260525-001',
      }),
    );
    expect(mail.sendInvoiceCreatedMail).toHaveBeenCalledWith(
      expect.objectContaining({
        recipientEmail: 'admin@example.com',
        invoiceId: 'INV-20260525-001',
      }),
    );
  });

  it('resets a rejected quote back to PENDING when staff edits it', async () => {
    const { prisma, tx } = createPrismaMock();
    prisma.quote.findUnique.mockResolvedValue({
      id: 'quote-1',
      quoteId: 'QT-2026-00001',
      status: QuoteStatus.REJECTED,
      dateIssued: new Date('2026-05-17T00:00:00.000Z'),
      validUntil: new Date('2026-05-31T00:00:00.000Z'),
      total: new Prisma.Decimal('4389'),
      taxAmount: new Prisma.Decimal('89'),
      paymentSchedule: {
        id: 'schedule-1',
      },
      commission: {
        staffId: 'staff-1',
        percentageCommission: new Prisma.Decimal('0'),
        status: CommissionStatus.QUOTED_COMMISSION,
      },
      project: {
        id: 'project-1',
        status: ProjectStatus.LOST,
        client: {
          id: 'client-1',
          accountPartnerId: 'staff-1',
        },
      },
    });
    prisma.catalogItem.findMany.mockResolvedValue([
      {
        id: 'service-1',
        productName: 'Solar Panel Installation',
        ourPrice: new Prisma.Decimal('4200'),
      },
    ]);
    tx.quote.update.mockResolvedValue({
      id: 'quote-1',
      name: 'Solar Panel Installation',
      quoteId: 'QT-2026-00001',
      status: QuoteStatus.PENDING,
      message: null,
      clientComment: null,
      dateIssued: new Date('2026-05-17T00:00:00.000Z'),
      validUntil: new Date('2026-05-31T00:00:00.000Z'),
      subtotal: new Prisma.Decimal('4300'),
      tax: new Prisma.Decimal('8'),
      taxAmount: new Prisma.Decimal('89'),
      discount: new Prisma.Decimal('100'),
      shippingFee: new Prisma.Decimal('40'),
      total: new Prisma.Decimal('4389'),
      createdAt: new Date('2026-05-24T10:30:00.000Z'),
      updatedAt: new Date('2026-05-25T08:00:00.000Z'),
      project: {
        id: 'project-1',
        name: 'Solar Site Buildout',
        status: ProjectStatus.QUOTED,
        clientId: 'client-1',
      },
      lineItems: [
        {
          id: 'line-1',
          productName: 'Solar Panel Installation',
          ourPrice: new Prisma.Decimal('4200'),
          quantity: 3,
        },
      ],
      paymentSchedule: {
        type: QuotePaymentScheduleType.DEPOSIT_AND_BALANCE,
        totalAmount: new Prisma.Decimal('4389'),
        items: [
          createScheduleItem({
            itemType: QuotePaymentScheduleItemType.DEPOSIT,
            name: 'Deposit',
            amountType: QuotePaymentScheduleAmountType.FIXED,
            percentage: new Prisma.Decimal('20'),
            amount: new Prisma.Decimal('877.8'),
            dateType: QuotePaymentScheduleDateType.INVOICE_GENERATION,
            dueDate: null,
            position: 0,
          }),
          createScheduleItem({
            itemType: QuotePaymentScheduleItemType.BALANCE,
            name: 'Balance',
            amount: new Prisma.Decimal('3511.2'),
            percentage: new Prisma.Decimal('80'),
            dueDate: new Date('2026-06-30T00:00:00.000Z'),
            position: 1,
          }),
        ],
      },
      invoices: [],
    });

    const service = new QuotesService(
      prisma as any,
      createMailMock() as any,
      createPdfMock() as any,
      createJwtMock() as any,
    );
    const result = await service.updateQuote(
      'quote-1',
      {
        subtotal: 4300,
        tax: 8,
        taxAmount: 89,
        discount: 100,
        shippingFee: 40,
        total: 4389,
        lineItems: [{ serviceId: 'service-1', quantity: 3 }],
        paymentSchedule: {
          type: QuotePaymentScheduleType.DEPOSIT_AND_BALANCE,
          totalAmount: 4389,
          deposit: {
            name: 'Deposit',
            amountType: 'fixed',
            percentage: 20,
            amount: 877.8,
            date: 'Date of Invoice Generation',
          },
          balance: {
            name: 'Balance',
            amount: 3511.2,
            percentage: 80,
            date: '2026/30/06',
          },
        },
      },
      staffUser,
    );

    expect(tx.quote.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          lineItems: {
            deleteMany: {},
            create: [
              {
                productName: 'Solar Panel Installation',
                ourPrice: new Prisma.Decimal('4200'),
                quantity: 3,
              },
            ],
          },
          paymentSchedule: {
            upsert: {
              create: expect.any(Object),
              update: expect.objectContaining({
                type: QuotePaymentScheduleType.DEPOSIT_AND_BALANCE,
                items: {
                  deleteMany: {},
                  create: [
                    expect.objectContaining({
                      itemType: QuotePaymentScheduleItemType.DEPOSIT,
                    }),
                    expect.objectContaining({
                      itemType: QuotePaymentScheduleItemType.BALANCE,
                    }),
                  ],
                },
              }),
            },
          },
        }),
      }),
    );
    expect(tx.project.update).toHaveBeenCalledWith({
      where: { id: 'project-1' },
      data: { status: ProjectStatus.QUOTED },
    });
    expect(tx.commission.upsert).toHaveBeenCalledWith({
      where: {
        quoteId: 'quote-1',
      },
      create: {
        quoteId: 'quote-1',
        clientId: 'client-1',
        staffId: 'staff-1',
        total: new Prisma.Decimal('4300'),
        percentageCommission: new Prisma.Decimal('0'),
        amount: new Prisma.Decimal('0'),
        status: CommissionStatus.QUOTED_COMMISSION,
      },
      update: {
        clientId: 'client-1',
        staffId: 'staff-1',
        total: new Prisma.Decimal('4300'),
        amount: new Prisma.Decimal('0'),
        status: CommissionStatus.QUOTED_COMMISSION,
      },
    });
    expect(result.quote.status).toBe(QuoteStatus.PENDING);
    expect(result.quote.lineItems).toEqual([
      expect.objectContaining({
        quantity: 3,
        lineTotal: '12600',
      }),
    ]);
    expect(result.quote.paymentSchedule).toEqual({
      type: QuotePaymentScheduleType.DEPOSIT_AND_BALANCE,
      totalAmount: '4389',
      deposit: {
        name: 'Deposit',
        amountType: 'fixed',
        amount: '877.8',
        percentage: '20',
        date: 'Date of Invoice Generation',
      },
      balance: {
        name: 'Balance',
        amount: '3511.2',
        percentage: '80',
        date: '2026-06-30T00:00:00.000Z',
      },
    });
    expect(result.quote.message).toBeNull();
    expect(result.quote.discount).toBe('100');
    expect(result.quote.shippingFee).toBe('40');
  });

  describe('downloadQuote', () => {
    function createQuoteDocumentRecord() {
      return {
        id: 'quote-1',
        name: 'Solar Panel Installation',
        quoteId: 'QT-2026-00001',
        status: QuoteStatus.PENDING,
        message: 'Doors to be solid core Masonite Carrara.',
        clientComment: null,
        dateIssued: new Date('2026-05-17T00:00:00.000Z'),
        validUntil: new Date('2026-05-31T00:00:00.000Z'),
        subtotal: new Prisma.Decimal('4200'),
        tax: new Prisma.Decimal('8'),
        taxAmount: new Prisma.Decimal('336'),
        discount: new Prisma.Decimal('0'),
        shippingFee: new Prisma.Decimal('0'),
        total: new Prisma.Decimal('4536'),
        createdAt: new Date('2026-05-17T00:00:00.000Z'),
        updatedAt: new Date('2026-05-17T00:00:00.000Z'),
        project: {
          id: 'project-1',
          name: 'Solar Site Buildout',
          location: 'Jeffersontown, Kentucky',
          status: ProjectStatus.QUOTED,
          clientId: 'client-1',
          client: {
            name: 'Chris Rutlage',
            email: 'chris@example.com',
            phone: '(502) 555-0100',
            company: 'Rutlage Energy',
            additionalEmail: null,
          },
        },
        lineItems: [
          {
            id: 'line-1',
            productName: 'Solar Panel Installation',
            ourPrice: new Prisma.Decimal('4200'),
            quantity: 1,
          },
        ],
        paymentSchedule: {
          type: QuotePaymentScheduleType.FULL_PAYMENT,
          totalAmount: new Prisma.Decimal('4536'),
          items: [
            createScheduleItem({
              amount: new Prisma.Decimal('4536'),
            }),
          ],
        },
        invoices: [],
      };
    }

    it('generates a PDF for a visible quote', async () => {
      const { prisma } = createPrismaMock();
      prisma.quote.findFirst.mockResolvedValue(createQuoteDocumentRecord());
      const pdf = createPdfMock();
      const service = new QuotesService(
        prisma as any,
        createMailMock() as any,
        pdf as any,
        createJwtMock() as any,
      );

      const result = await service.downloadQuote('quote-1', clientUser);

      expect(prisma.quote.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'quote-1',
            project: { clientId: 'client-1' },
          }),
        }),
      );
      expect(pdf.generateQuotePdf).toHaveBeenCalledWith(
        expect.objectContaining({
          docNumber: 'QT-2026-00001',
          projectName: 'Solar Site Buildout',
          clientName: 'Chris Rutlage',
          total: '$4,536.00',
        }),
      );
      expect(result.filename).toBe('QT-2026-00001.pdf');
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('throws a 404 when the quote is not visible or does not exist', async () => {
      const { prisma } = createPrismaMock();
      prisma.quote.findFirst.mockResolvedValue(null);
      const service = new QuotesService(
        prisma as any,
        createMailMock() as any,
        createPdfMock() as any,
        createJwtMock() as any,
      );

      await expect(
        service.downloadQuote('quote-1', clientUser),
      ).rejects.toMatchObject({ status: 404 });
    });
  });

  describe('downloadInvoice', () => {
    function createInvoiceDocumentRecord() {
      return {
        id: 'invoice-1',
        invoiceId: 'INV-2026-00001',
        status: QuoteStatus.PENDING,
        dateIssued: new Date('2026-05-17T00:00:00.000Z'),
        validUntil: new Date('2026-05-31T00:00:00.000Z'),
        subtotal: new Prisma.Decimal('4200'),
        tax: new Prisma.Decimal('8'),
        taxAmount: new Prisma.Decimal('336'),
        discount: new Prisma.Decimal('0'),
        shippingFee: new Prisma.Decimal('0'),
        total: new Prisma.Decimal('4536'),
        message: null,
        clientComment: 'Looks good, approved.',
        lineItems: [
          {
            productName: 'Solar Panel Installation',
            ourPrice: new Prisma.Decimal('4200'),
            quantity: 1,
          },
        ],
        payments: [
          {
            id: 'payment-1',
            createdAt: new Date('2026-06-01T00:00:00.000Z'),
            method: 'WIRE',
            reference: 'REF-001',
            amount: new Prisma.Decimal('2000'),
          },
        ],
        quote: {
          quoteId: 'QT-2026-00001',
          name: 'Solar Panel Installation',
        },
        project: {
          id: 'project-1',
          name: 'Solar Site Buildout',
          location: 'Jeffersontown, Kentucky',
          client: {
            name: 'Chris Rutlage',
            email: 'chris@example.com',
            phone: '(502) 555-0100',
            company: 'Rutlage Energy',
            additionalEmail: null,
          },
        },
      };
    }

    it('generates a PDF for a visible invoice with payment totals', async () => {
      const { prisma } = createPrismaMock();
      prisma.invoice.findFirst.mockResolvedValue(
        createInvoiceDocumentRecord(),
      );
      const pdf = createPdfMock();
      const service = new QuotesService(
        prisma as any,
        createMailMock() as any,
        pdf as any,
        createJwtMock() as any,
      );

      const result = await service.downloadInvoice('invoice-1', staffUser);

      expect(prisma.invoice.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            id: 'invoice-1',
            project: {},
          }),
        }),
      );
      expect(pdf.generateInvoicePdf).toHaveBeenCalledWith(
        expect.objectContaining({
          docNumber: 'INV-2026-00001',
          quoteId: 'QT-2026-00001',
          amountPaid: '$2,000.00',
          balanceDue: '$2,536.00',
          payments: [
            expect.objectContaining({
              method: 'Wire',
              amount: '$2,000.00',
            }),
          ],
        }),
      );
      expect(result.filename).toBe('INV-2026-00001.pdf');
      expect(result.buffer).toBeInstanceOf(Buffer);
    });

    it('throws a 404 when the invoice is not visible or does not exist', async () => {
      const { prisma } = createPrismaMock();
      prisma.invoice.findFirst.mockResolvedValue(null);
      const service = new QuotesService(
        prisma as any,
        createMailMock() as any,
        createPdfMock() as any,
        createJwtMock() as any,
      );

      await expect(
        service.downloadInvoice('invoice-1', clientUser),
      ).rejects.toMatchObject({ status: 404 });
    });
  });
});
