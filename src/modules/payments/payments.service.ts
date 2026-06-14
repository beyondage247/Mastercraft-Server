import { Injectable } from '@nestjs/common';
import {
  PaymentMethod,
  Prisma,
  ProjectPaymentStatus,
  QuoteStatus,
  Role,
} from '@prisma/client';
import { IAuthUser } from 'src/modules/auth/auth.types';
import { PrismaService } from 'src/services/prisma/prisma.service';
import { connectId } from 'src/services/prisma/prisma.utils';
import { bad } from 'src/utils/error.utils';
import { CreatePaymentInput } from './payment.types';

const paymentSelect = {
  id: true,
  projectId: true,
  invoiceId: true,
  createdAt: true,
  method: true,
  reference: true,
  amount: true,
} satisfies Prisma.PaymentSelect;

type PaymentRecord = Prisma.PaymentGetPayload<{
  select: typeof paymentSelect;
}>;

const adminPaymentSelect = {
  id: true,
  projectId: true,
  invoiceId: true,
  createdAt: true,
  method: true,
  reference: true,
  amount: true,
  project: {
    select: {
      id: true,
      name: true,
      paymentStatus: true,
      client: {
        select: {
          id: true,
          name: true,
          email: true,
          company: true,
        },
      },
    },
  },
} satisfies Prisma.PaymentSelect;

type AdminPaymentRecord = Prisma.PaymentGetPayload<{
  select: typeof adminPaymentSelect;
}>;

const clientPaymentSelect = {
  id: true,
  projectId: true,
  invoiceId: true,
  createdAt: true,
  method: true,
  reference: true,
  amount: true,
  project: {
    select: {
      id: true,
      name: true,
      paymentStatus: true,
    },
  },
} satisfies Prisma.PaymentSelect;

type ClientPaymentRecord = Prisma.PaymentGetPayload<{
  select: typeof clientPaymentSelect;
}>;

const paymentReferencePrefix: Record<PaymentMethod, string> = {
  [PaymentMethod.ACH]: 'ACH-',
  [PaymentMethod.WIRE]: 'WIRE-',
  [PaymentMethod.CREDIT_CARD]: 'CC-',
  [PaymentMethod.CHECK]: 'CHK-',
};

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async getPaymentList(user: IAuthUser) {
    if (!user.isAdmin) {
      bad('Only administrators can view all payments', 403);
    }

    const payments = await this.prisma.payment.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: adminPaymentSelect,
    });

    return payments.map((payment) => this.serializeAdminPayment(payment));
  }

  async getClientPayments(clientId: string, user: IAuthUser) {
    const client = await this.getClientForUser(clientId, user);

    const aggregate = await this.prisma.payment.aggregate({
      where: {
        project: {
          clientId,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const payments = await this.prisma.payment.findMany({
      where: {
        project: {
          clientId,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      select: clientPaymentSelect,
    });

    return {
      client: {
        id: client.id,
        name: client.name,
        email: client.email,
        company: client.company,
      },
      amountPaid: (aggregate._sum.amount ?? new Prisma.Decimal(0)).toString(),
      payments: payments.map((payment) => this.serializeClientPayment(payment)),
    };
  }

  async getProjectPayments(projectId: string, user: IAuthUser) {
    const project = await this.getProjectForUser(projectId, user);

    const billing = await this.getProjectBillingTotals(this.prisma, projectId);
    const amountDue = this.getAmountDue(
      billing.amountPaid,
      billing.totalInvoiced,
    );
    const paymentStatus = this.resolvePaymentStatus(
      billing.amountPaid,
      billing.totalInvoiced,
    );

    const payments = await this.prisma.payment.findMany({
      where: { projectId },
      orderBy: {
        createdAt: 'desc',
      },
      select: paymentSelect,
    });

    return {
      projectId,
      paymentStatus,
      amountPaid: billing.amountPaid.toString(),
      amountDue: amountDue.toString(),
      payments: payments.map((payment) => this.serializePayment(payment)),
    };
  }

  async createPayment(dto: CreatePaymentInput, user: IAuthUser) {
    const invoice = await this.getInvoiceForStaff(dto.invoiceId, user);

    const createdAt = this.toDate(dto.createdAt, 'createdAt');
    const amount = new Prisma.Decimal(dto.amount);

    if (amount.lessThanOrEqualTo(0)) {
      bad('amount must be greater than 0');
    }

    const reference =
      dto.reference?.trim() ||
      this.generateReference(dto.method, createdAt);

    this.validateReference(reference, dto.method);

    const result = await this.prisma.$transaction(async (tx) => {
      const existingReference = await tx.payment.findFirst({
        where: { reference },
        select: {
          id: true,
        },
      });

      if (existingReference) {
        bad('reference already exists');
      }

      const invoiceAggregate = await tx.payment.aggregate({
        where: { invoiceId: dto.invoiceId },
        _sum: {
          amount: true,
        },
      });

      const invoiceAmountPaid =
        invoiceAggregate._sum.amount ?? new Prisma.Decimal(0);
      const nextInvoiceAmountPaid = invoiceAmountPaid.add(amount);

      if (nextInvoiceAmountPaid.greaterThan(invoice.total)) {
        bad('Payment amount exceeds the remaining invoice balance');
      }

      const payment = await tx.payment.create({
        data: {
          invoice: connectId(dto.invoiceId),
          project: connectId(invoice.projectId),
          createdAt,
          method: dto.method,
          reference,
          amount,
        },
        select: paymentSelect,
      });

      const billing = await this.getProjectBillingTotals(tx, invoice.projectId);
      const paymentStatus = this.resolvePaymentStatus(
        billing.amountPaid,
        billing.totalInvoiced,
      );

      await tx.project.update({
        where: { id: invoice.projectId },
        data: {
          paymentStatus,
        },
      });

      return {
        payment,
        paymentStatus,
        amountPaid: billing.amountPaid,
        amountDue: this.getAmountDue(billing.amountPaid, billing.totalInvoiced),
      };
    });

    return {
      message: 'Payment recorded successfully',
      payment: this.serializePayment(result.payment),
      paymentStatus: result.paymentStatus,
      amountPaid: result.amountPaid.toString(),
      amountDue: result.amountDue.toString(),
    };
  }

  private async getProjectForUser(projectId: string, user: IAuthUser) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        clientId: true,
        paymentStatus: true,
        client: {
          select: {
            accountPartnerId: true,
          },
        },
      },
    });

    if (!project) bad('Project not found', 404);

    if (user.role === Role.CLIENT && project.clientId !== user.id) {
      bad('You can only view payments for your own projects', 403);
    }

    if (
      user.role === Role.STAFF &&
      !user.isAdmin &&
      project.client.accountPartnerId !== user.id
    ) {
      bad('You can only view payments for clients you are managing', 403);
    }

    return project;
  }

  private async getClientForUser(clientId: string, user: IAuthUser) {
    const client = await this.prisma.user.findFirst({
      where: {
        id: clientId,
        role: Role.CLIENT,
      },
      select: {
        id: true,
        name: true,
        email: true,
        company: true,
        accountPartnerId: true,
      },
    });

    if (!client) bad('Client not found', 404);

    if (user.role === Role.CLIENT && client.id !== user.id) {
      bad('You can only view your own payments', 403);
    }

    if (
      user.role === Role.STAFF &&
      !user.isAdmin &&
      client.accountPartnerId !== user.id
    ) {
      bad('You can only view payments for clients you are managing', 403);
    }

    return client;
  }

  private async getInvoiceForStaff(invoiceId: string, user: IAuthUser) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        projectId: true,
        status: true,
        total: true,
        project: {
          select: {
            client: {
              select: {
                accountPartnerId: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) bad('Invoice not found', 404);

    if (!user.isAdmin && invoice.project.client.accountPartnerId !== user.id) {
      bad('You can only record payments for invoices assigned to your clients', 403);
    }

    if (invoice.status !== QuoteStatus.APPROVED) {
      bad('Payments can only be recorded for approved invoices');
    }

    return invoice;
  }

  private async getProjectBillingTotals(
    prisma: Pick<PrismaService, 'invoice' | 'payment'> | Prisma.TransactionClient,
    projectId: string,
  ) {
    const [invoiceAggregate, paymentAggregate] = await Promise.all([
      prisma.invoice.aggregate({
        where: { projectId },
        _sum: {
          total: true,
        },
      }),
      prisma.payment.aggregate({
        where: { projectId },
        _sum: {
          amount: true,
        },
      }),
    ]);

    return {
      totalInvoiced: invoiceAggregate._sum.total ?? new Prisma.Decimal(0),
      amountPaid: paymentAggregate._sum.amount ?? new Prisma.Decimal(0),
    };
  }

  private resolvePaymentStatus(
    amountPaid: Prisma.Decimal,
    totalInvoiced: Prisma.Decimal,
  ) {
    if (totalInvoiced.lessThanOrEqualTo(0)) {
      return ProjectPaymentStatus.UNPAID;
    }

    if (amountPaid.lessThanOrEqualTo(0)) {
      return ProjectPaymentStatus.UNPAID;
    }

    if (amountPaid.greaterThanOrEqualTo(totalInvoiced)) {
      return ProjectPaymentStatus.PAID;
    }

    return ProjectPaymentStatus.PARTIALLY_PAID;
  }

  private getAmountDue(
    amountPaid: Prisma.Decimal,
    totalInvoiced?: Prisma.Decimal | null,
  ) {
    if (!totalInvoiced) {
      return new Prisma.Decimal(0);
    }

    if (totalInvoiced.lessThanOrEqualTo(amountPaid)) {
      return new Prisma.Decimal(0);
    }

    return totalInvoiced.sub(amountPaid);
  }

  private validateReference(reference: string, method: PaymentMethod) {
    const prefix = paymentReferencePrefix[method];

    if (!reference.startsWith(prefix)) {
      bad(`reference must start with ${prefix} for ${method} payments`);
    }

    if (reference.length <= prefix.length) {
      bad('reference must include a value after the payment type prefix');
    }
  }

  private generateReference(method: PaymentMethod, createdAt: Date) {
    return `${paymentReferencePrefix[method]}${this.formatReferenceTimestamp(createdAt)}`;
  }

  private formatReferenceTimestamp(date: Date) {
    const parts = [
      date.getUTCFullYear().toString().padStart(4, '0'),
      (date.getUTCMonth() + 1).toString().padStart(2, '0'),
      date.getUTCDate().toString().padStart(2, '0'),
      date.getUTCHours().toString().padStart(2, '0'),
      date.getUTCMinutes().toString().padStart(2, '0'),
      date.getUTCSeconds().toString().padStart(2, '0'),
      date.getUTCMilliseconds().toString().padStart(3, '0'),
    ];

    return parts.join('');
  }

  private toDate(value: string, fieldName: string) {
    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      bad(`Invalid ${fieldName} value`);
    }

    return parsed;
  }

  private serializePayment(payment: PaymentRecord) {
    return {
      id: payment.id,
      projectId: payment.projectId,
      invoiceId: payment.invoiceId,
      createdAt: payment.createdAt.toISOString(),
      method: payment.method,
      reference: payment.reference,
      amount: payment.amount.toString(),
    };
  }

  private serializeAdminPayment(payment: AdminPaymentRecord) {
    return {
      id: payment.id,
      projectId: payment.projectId,
      invoiceId: payment.invoiceId,
      createdAt: payment.createdAt.toISOString(),
      method: payment.method,
      reference: payment.reference,
      amount: payment.amount.toString(),
      project: {
        id: payment.project.id,
        name: payment.project.name,
        paymentStatus: payment.project.paymentStatus,
        client: {
          id: payment.project.client.id,
          name: payment.project.client.name,
          email: payment.project.client.email,
          company: payment.project.client.company,
        },
      },
    };
  }

  private serializeClientPayment(payment: ClientPaymentRecord) {
    return {
      id: payment.id,
      projectId: payment.projectId,
      invoiceId: payment.invoiceId,
      createdAt: payment.createdAt.toISOString(),
      method: payment.method,
      reference: payment.reference,
      amount: payment.amount.toString(),
      project: {
        id: payment.project.id,
        name: payment.project.name,
        paymentStatus: payment.project.paymentStatus,
      },
    };
  }
}
