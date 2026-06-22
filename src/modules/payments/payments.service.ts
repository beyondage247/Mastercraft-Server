import { Injectable, Logger } from '@nestjs/common';
import {
  PaymentMethod,
  Prisma,
  ProjectPaymentStatus,
  QuoteStatus,
  Role,
} from '@prisma/client';
import Stripe = require('stripe');
import { IAuthUser } from 'src/modules/auth/auth.types';
import { PrismaService } from 'src/services/prisma/prisma.service';
import { StripeService } from 'src/services/stripe/stripe.service';
import { connectId } from 'src/services/prisma/prisma.utils';
import { bad } from 'src/utils/error.utils';
import { ConfirmCheckoutInput, CreateCheckoutInput } from './payment.types';

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

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
  ) {}

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

  async createCheckoutSession(dto: CreateCheckoutInput, user: IAuthUser) {
    const invoice = await this.getInvoiceForCheckout(dto.invoiceId, user);

    const invoiceAggregate = await this.prisma.payment.aggregate({
      where: { invoiceId: dto.invoiceId },
      _sum: { amount: true },
    });
    const amountPaid =
      invoiceAggregate._sum.amount ?? new Prisma.Decimal(0);
    const remainingBalance = invoice.total.sub(amountPaid);

    if (remainingBalance.lessThanOrEqualTo(0)) {
      bad('This invoice has already been fully paid');
    }

    const amount = dto.amount
      ? new Prisma.Decimal(dto.amount)
      : remainingBalance;

    if (amount.lessThanOrEqualTo(0)) {
      bad('Amount must be greater than 0');
    }

    if (amount.greaterThan(remainingBalance)) {
      bad('Payment amount exceeds the remaining invoice balance');
    }

    const amountInCents = Math.round(amount.toNumber() * 100);

    const session = await this.stripeService.stripe.checkout.sessions.create({
      mode: 'payment',
      customer_email: invoice.project.client.email,
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: `Invoice ${invoice.invoiceId}`,
              description: `Project: ${invoice.project.name}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      metadata: {
        invoiceId: dto.invoiceId,
        projectId: invoice.projectId,
      },
      success_url: process.env.STRIPE_SUCCESS_URL!,
      cancel_url: process.env.STRIPE_CANCEL_URL!,
    });

    return { url: session.url };
  }

  async confirmCheckoutSession(dto: ConfirmCheckoutInput, user: IAuthUser) {
    const session =
      await this.stripeService.stripe.checkout.sessions.retrieve(
        dto.sessionId,
      );

    if (session.payment_status !== 'paid') {
      return { confirmed: false, message: 'Payment has not been completed.' };
    }

    const invoiceId = session.metadata?.invoiceId;
    const projectId = session.metadata?.projectId;

    if (!invoiceId || !projectId) {
      return { confirmed: false, message: 'Session metadata is missing.' };
    }

    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        project: {
          select: {
            clientId: true,
            client: { select: { accountPartnerId: true } },
          },
        },
      },
    });

    if (!invoice) {
      return { confirmed: false, message: 'Invoice not found.' };
    }

    if (
      user.role === Role.CLIENT &&
      invoice.project.clientId !== user.id
    ) {
      bad('You can only confirm payments for your own invoices', 403);
    }

    if (
      user.role === Role.STAFF &&
      !user.isAdmin &&
      invoice.project.client.accountPartnerId !== user.id
    ) {
      bad('You can only confirm payments for your clients', 403);
    }

    const paymentIntentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;

    const reference = `STRIPE-${paymentIntentId ?? session.id}`;

    const existing = await this.prisma.payment.findFirst({
      where: { reference },
      select: { id: true },
    });

    if (existing) {
      return { confirmed: true, message: 'Payment already recorded.' };
    }

    if (!session.amount_total) {
      return { confirmed: false, message: 'Session has no amount.' };
    }

    const amount = new Prisma.Decimal(session.amount_total).div(100);
    await this.recordStripePayment(invoiceId, projectId, amount, reference);

    return { confirmed: true, message: 'Payment recorded successfully.' };
  }

  async handleWebhook(rawBody: Buffer, signature: string) {
    let event: Stripe.Event;

    try {
      event = this.stripeService.constructEvent(rawBody, signature);
    } catch (err) {
      this.logger.error('Stripe webhook signature verification failed', err);
      bad('Invalid webhook signature', 400);
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;

      if (session.payment_status !== 'paid') {
        return { received: true };
      }

      const invoiceId = session.metadata?.invoiceId;
      const projectId = session.metadata?.projectId;

      if (!invoiceId || !projectId) {
        this.logger.warn(
          `Stripe webhook: checkout session ${session.id} missing metadata, skipping`,
        );
        return { received: true };
      }

      const paymentIntentId =
        typeof session.payment_intent === 'string'
          ? session.payment_intent
          : session.payment_intent?.id;

      const reference = `STRIPE-${paymentIntentId ?? session.id}`;

      const existing = await this.prisma.payment.findFirst({
        where: { reference },
        select: { id: true },
      });

      if (existing) {
        return { received: true };
      }

      if (!session.amount_total) {
        this.logger.warn(
          `Stripe webhook: checkout session ${session.id} has no amount_total, skipping`,
        );
        return { received: true };
      }

      const amount = new Prisma.Decimal(session.amount_total).div(100);

      await this.recordStripePayment(invoiceId, projectId, amount, reference);
    }

    return { received: true };
  }

  private async recordStripePayment(
    invoiceId: string,
    projectId: string,
    amount: Prisma.Decimal,
    reference: string,
  ) {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.payment.create({
          data: {
            invoice: connectId(invoiceId),
            project: connectId(projectId),
            method: PaymentMethod.STRIPE,
            reference,
            amount,
          },
        });

        const billing = await this.getProjectBillingTotals(tx, projectId);
        const paymentStatus = this.resolvePaymentStatus(
          billing.amountPaid,
          billing.totalInvoiced,
        );

        await tx.project.update({
          where: { id: projectId },
          data: { paymentStatus },
        });
      });

      this.logger.log(
        `Stripe payment recorded: ${reference} — ${amount} for invoice ${invoiceId}`,
      );
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        this.logger.log(
          `Stripe payment already recorded: ${reference} — skipping duplicate`,
        );
        return;
      }
      throw error;
    }
  }

  private async getInvoiceForCheckout(invoiceId: string, user: IAuthUser) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id: invoiceId },
      select: {
        id: true,
        invoiceId: true,
        projectId: true,
        status: true,
        total: true,
        project: {
          select: {
            name: true,
            clientId: true,
            client: {
              select: {
                email: true,
                accountPartnerId: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) bad('Invoice not found', 404);

    if (user.role === Role.CLIENT && invoice.project.clientId !== user.id) {
      bad('You can only pay for your own invoices', 403);
    }

    if (
      user.role === Role.STAFF &&
      !user.isAdmin &&
      invoice.project.client.accountPartnerId !== user.id
    ) {
      bad(
        'You can only create payment links for invoices assigned to your clients',
        403,
      );
    }

    if (invoice.status !== QuoteStatus.APPROVED) {
      bad('Payments can only be made for approved invoices');
    }

    return invoice;
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

  private async getProjectBillingTotals(
    prisma:
      | Pick<PrismaService, 'invoice' | 'payment'>
      | Prisma.TransactionClient,
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
