import { Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
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
import { IAuthUser } from 'src/modules/auth/auth.types';
import { MailService } from 'src/services/mail/mail.service';
import { PdfService } from 'src/services/pdf/pdf.service';
import { InvoicePdfData, QuotePdfData } from 'src/services/pdf/pdf.types';
import { PrismaService } from 'src/services/prisma/prisma.service';
import { bad } from 'src/utils/error.utils';
import {
  formatCurrency,
  formatDate,
  formatPaymentMethod,
  formatPercentage,
  formatScheduleDueDate,
  getPaymentScheduleLabel,
  invoiceGenerationLabel,
} from 'src/utils/format.utils';
import { IdGenerator } from 'src/utils/id-generator.utils';
import {
  CreateQuoteInput,
  QuotePaymentScheduleInput,
  QuoteLineItemInput,
  RespondToQuoteInput,
  UpdateQuoteInput,
} from './quotes.types';

type PublicDownloadKind = 'quote' | 'invoice';

interface PublicDownloadTokenPayload {
  type: 'document-download';
  kind: PublicDownloadKind;
  documentId: string;
}

const quoteSelect = {
  id: true,
  name: true,
  quoteId: true,
  status: true,
  message: true,
  clientComment: true,
  dateIssued: true,
  validUntil: true,
  subtotal: true,
  tax: true,
  taxAmount: true,
  discount: true,
  shippingFee: true,
  total: true,
  createdAt: true,
  updatedAt: true,
  project: {
    select: {
      id: true,
      name: true,
      status: true,
      clientId: true,
    },
  },
  lineItems: {
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      id: true,
      productName: true,
      ourPrice: true,
      quantity: true,
    },
  },
  paymentSchedule: {
    select: {
      type: true,
      totalAmount: true,
      items: {
        orderBy: {
          position: 'asc',
        },
        select: {
          itemType: true,
          name: true,
          amountType: true,
          percentage: true,
          amount: true,
          dateType: true,
          dueDate: true,
          position: true,
        },
      },
    },
  },
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
      payments: {
        orderBy: {
          createdAt: 'asc',
        },
        select: {
          id: true,
          createdAt: true,
          method: true,
          reference: true,
          amount: true,
        },
      },
    },
  },
} satisfies Prisma.QuoteSelect;

const quoteProjectSelect = {
  id: true,
  name: true,
  location: true,
  status: true,
  client: {
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      company: true,
      additionalEmail: true,
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
} satisfies Prisma.ProjectSelect;

const quoteApprovalSelect = {
  id: true,
  name: true,
  quoteId: true,
  projectId: true,
  status: true,
  message: true,
  dateIssued: true,
  validUntil: true,
  subtotal: true,
  tax: true,
  taxAmount: true,
  discount: true,
  shippingFee: true,
  total: true,
  project: {
    select: quoteProjectSelect,
  },
  commission: {
    select: {
      staffId: true,
      percentageCommission: true,
      status: true,
    },
  },
  lineItems: {
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      productName: true,
      ourPrice: true,
      quantity: true,
    },
  },
} satisfies Prisma.QuoteSelect;

const quoteDocumentClientSelect = {
  name: true,
  email: true,
  phone: true,
  company: true,
  additionalEmail: true,
} satisfies Prisma.UserSelect;

const quoteDocumentSelect = {
  ...quoteSelect,
  project: {
    select: {
      id: true,
      name: true,
      location: true,
      status: true,
      clientId: true,
      client: {
        select: quoteDocumentClientSelect,
      },
    },
  },
} satisfies Prisma.QuoteSelect;

const invoiceDocumentSelect = {
  id: true,
  invoiceId: true,
  status: true,
  dateIssued: true,
  validUntil: true,
  subtotal: true,
  tax: true,
  taxAmount: true,
  discount: true,
  shippingFee: true,
  total: true,
  message: true,
  clientComment: true,
  lineItems: {
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      productName: true,
      ourPrice: true,
      quantity: true,
    },
  },
  payments: {
    orderBy: {
      createdAt: 'asc',
    },
    select: {
      id: true,
      createdAt: true,
      method: true,
      reference: true,
      amount: true,
    },
  },
  quote: {
    select: {
      quoteId: true,
      name: true,
    },
  },
  project: {
    select: {
      id: true,
      name: true,
      location: true,
      client: {
        select: quoteDocumentClientSelect,
      },
    },
  },
} satisfies Prisma.InvoiceSelect;

type QuoteRecord = Prisma.QuoteGetPayload<{
  select: typeof quoteSelect;
}>;
type QuoteProjectRecord = Prisma.ProjectGetPayload<{
  select: typeof quoteProjectSelect;
}>;
type QuoteApprovalRecord = Prisma.QuoteGetPayload<{
  select: typeof quoteApprovalSelect;
}>;
type QuoteDocumentRecord = Prisma.QuoteGetPayload<{
  select: typeof quoteDocumentSelect;
}>;
type InvoiceDocumentRecord = Prisma.InvoiceGetPayload<{
  select: typeof invoiceDocumentSelect;
}>;

type PaymentScheduleRecord = NonNullable<QuoteRecord['paymentSchedule']>;
type PaymentScheduleItemRecord = PaymentScheduleRecord['items'][number];

type NormalizedPaymentScheduleItem = {
  itemType: QuotePaymentScheduleItemType;
  name: string;
  amountType: QuotePaymentScheduleAmountType | null;
  percentage: Prisma.Decimal;
  amount: Prisma.Decimal;
  dateType: QuotePaymentScheduleDateType;
  dueDate: Date | null;
  position: number;
};

type NormalizedPaymentSchedule = {
  type: QuotePaymentScheduleType;
  totalAmount: Prisma.Decimal;
  items: NormalizedPaymentScheduleItem[];
};

const hundred = new Prisma.Decimal(100);
const decimalTolerance = new Prisma.Decimal('0.01');

@Injectable()
export class QuotesService {
  private readonly logger = new Logger(QuotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly pdf: PdfService,
    private readonly jwtService: JwtService,
  ) {}

  private idGenerator = new IdGenerator({
    model: 'quote',
    column: 'quoteId',
    prefix: 'QOT',
  });

  private invoiceIdGenerator = new IdGenerator({
    model: 'invoice',
    column: 'invoiceId',
    prefix: 'INV',
  });

  async getQuoteList(user: IAuthUser) {
    const quotes = await this.prisma.quote.findMany({
      where: this.getQuoteVisibilityWhere(user),
      orderBy: {
        createdAt: 'desc',
      },
      select: quoteSelect,
    });

    return quotes.map((quote) => this.serializeQuote(quote));
  }

  async getQuote(id: string, user: IAuthUser) {
    const quote = await this.prisma.quote.findFirst({
      where: {
        id,
        ...this.getQuoteVisibilityWhere(user),
      },
      select: quoteSelect,
    });

    if (!quote) bad('Quote not found', 404);
    return this.serializeQuote(quote);
  }

  async downloadQuote(id: string, user: IAuthUser) {
    const quote = await this.prisma.quote.findFirst({
      where: {
        id,
        ...this.getQuoteVisibilityWhere(user),
      },
      select: quoteDocumentSelect,
    });

    if (!quote) bad('Quote not found', 404);

    const buffer = await this.pdf.generateQuotePdf(
      this.buildQuotePdfData(quote),
    );

    return { filename: `${quote.quoteId}.pdf`, buffer };
  }

  async downloadQuotePublic(id: string, token: string) {
    await this.verifyPublicDownloadToken(token, 'quote', id);

    const quote = await this.prisma.quote.findUnique({
      where: { id },
      select: quoteDocumentSelect,
    });

    if (!quote) bad('Quote not found', 404);

    const buffer = await this.pdf.generateQuotePdf(
      this.buildQuotePdfData(quote),
    );

    return { filename: `${quote.quoteId}.pdf`, buffer };
  }

  async downloadInvoice(id: string, user: IAuthUser) {
    const invoice = await this.prisma.invoice.findFirst({
      where: {
        id,
        project: this.getProjectVisibilityWhere(user),
      },
      select: invoiceDocumentSelect,
    });

    if (!invoice) bad('Invoice not found', 404);

    const buffer = await this.pdf.generateInvoicePdf(
      this.buildInvoicePdfData(invoice),
    );

    return { filename: `${invoice.invoiceId}.pdf`, buffer };
  }

  async downloadInvoicePublic(id: string, token: string) {
    await this.verifyPublicDownloadToken(token, 'invoice', id);

    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      select: invoiceDocumentSelect,
    });

    if (!invoice) bad('Invoice not found', 404);

    const buffer = await this.pdf.generateInvoicePdf(
      this.buildInvoicePdfData(invoice),
    );

    return { filename: `${invoice.invoiceId}.pdf`, buffer };
  }

  private buildQuotePdfData(quote: QuoteDocumentRecord): QuotePdfData {
    const paymentSchedule =
      quote.paymentSchedule?.items.map((item) => ({
        name: item.name,
        dueDate: formatScheduleDueDate(item),
        percentage: formatPercentage(item.percentage),
        amount: formatCurrency(item.amount),
      })) ?? [];

    return {
      docNumber: quote.quoteId,
      dateIssued: formatDate(quote.dateIssued),
      validUntil: formatDate(quote.validUntil),
      projectName: quote.project.name,
      projectLocation: quote.project.location ?? null,
      clientName: quote.project.client.name,
      clientEmail: quote.project.client.email,
      clientPhone: quote.project.client.phone ?? null,
      clientCompany: quote.project.client.company ?? null,
      lineItems: quote.lineItems.map((lineItem) => ({
        productName: lineItem.productName,
        quantity: lineItem.quantity,
        unitPrice: lineItem.ourPrice ? formatCurrency(lineItem.ourPrice) : null,
        amount: lineItem.ourPrice
          ? formatCurrency(lineItem.ourPrice.mul(lineItem.quantity))
          : null,
      })),
      subtotal: formatCurrency(quote.subtotal),
      taxLabel: `Tax (${formatPercentage(quote.tax)})`,
      taxAmount: formatCurrency(quote.taxAmount),
      showTax: quote.taxAmount.greaterThan(0),
      discount: formatCurrency(quote.discount),
      showDiscount: quote.discount.greaterThan(0),
      shippingFee: formatCurrency(quote.shippingFee),
      showShippingFee: quote.shippingFee.greaterThan(0),
      total: formatCurrency(quote.total),
      message: quote.message,
      clientComment: quote.clientComment,
      paymentSchedule,
    };
  }

  private buildInvoicePdfData(invoice: InvoiceDocumentRecord): InvoicePdfData {
    const amountPaid = invoice.payments.reduce(
      (sum, payment) => sum.plus(payment.amount),
      new Prisma.Decimal(0),
    );
    const balanceDue = invoice.total.minus(amountPaid);

    return {
      docNumber: invoice.invoiceId,
      dateIssued: formatDate(invoice.dateIssued),
      validUntil: formatDate(invoice.validUntil),
      projectName: invoice.project.name,
      projectLocation: invoice.project.location ?? null,
      clientName: invoice.project.client.name,
      clientEmail: invoice.project.client.email,
      clientPhone: invoice.project.client.phone ?? null,
      clientCompany: invoice.project.client.company ?? null,
      lineItems: invoice.lineItems.map((lineItem) => ({
        productName: lineItem.productName,
        quantity: lineItem.quantity,
        unitPrice: lineItem.ourPrice ? formatCurrency(lineItem.ourPrice) : null,
        amount: lineItem.ourPrice
          ? formatCurrency(lineItem.ourPrice.mul(lineItem.quantity))
          : null,
      })),
      subtotal: formatCurrency(invoice.subtotal),
      taxLabel: `Tax (${formatPercentage(invoice.tax)})`,
      taxAmount: formatCurrency(invoice.taxAmount),
      showTax: invoice.taxAmount.greaterThan(0),
      discount: formatCurrency(invoice.discount),
      showDiscount: invoice.discount.greaterThan(0),
      shippingFee: formatCurrency(invoice.shippingFee),
      showShippingFee: invoice.shippingFee.greaterThan(0),
      total: formatCurrency(invoice.total),
      message: invoice.message,
      clientComment: invoice.clientComment,
      quoteId: invoice.quote.quoteId,
      amountPaid: formatCurrency(amountPaid),
      balanceDue: formatCurrency(balanceDue),
      payments: invoice.payments.map((payment) => ({
        date: formatDate(payment.createdAt),
        method: formatPaymentMethod(payment.method),
        reference: payment.reference,
        amount: formatCurrency(payment.amount),
      })),
    };
  }

  async createQuote(dto: CreateQuoteInput, user: IAuthUser) {
    const project = await this.getProjectForStaff(dto.projectId, user);

    if (
      project.status !== ProjectStatus.PENDING &&
      project.status !== ProjectStatus.QUOTED &&
      project.status !== ProjectStatus.LOST
    ) {
      bad(
        'Quotes can only be created for projects in PENDING, QUOTED, or LOST status',
      );
    }

    const { dateIssued, validUntil } = this.validateQuoteDates(
      dto.dateIssued,
      dto.validUntil,
    );
    const lineItems = await this.getCatalogLineItems(dto.lineItems);
    const discount = this.toNonNegativeDecimal(dto.discount ?? 0, 'discount');
    const shippingFee = this.toNonNegativeDecimal(
      dto.shippingFee ?? 0,
      'shippingFee',
    );
    const message = dto.message?.trim() || null;
    const quoteTotal = this.toDecimal(dto.total, 'total');
    const quoteTaxAmount = this.toDecimal(dto.taxAmount, 'taxAmount');
    const paymentSchedule = this.validateAndNormalizePaymentSchedule(
      dto.paymentSchedule,
      quoteTotal,
    );
    const commissionStaffId = project.client.accountPartnerId;

    if (!commissionStaffId) {
      bad(
        'This quote cannot be created because the client has no assigned staff user for commission',
      );
    }

    const autoApprove = dto.autoApprove === true;
    let createdInvoiceId: string | null = null;
    let createdInvoiceDbId: string | null = null;

    const quote = await this.prisma.$transaction(async (tx) => {
      const quoteId = await this.idGenerator.nextId(tx);
      const createdQuote = await tx.quote.create({
        data: {
          quoteId,
          projectId: dto.projectId,
          name: dto.name.trim(),
          status: autoApprove ? QuoteStatus.APPROVED : QuoteStatus.PENDING,
          message,
          clientComment: null,
          dateIssued,
          validUntil,
          subtotal: new Prisma.Decimal(dto.subtotal),
          tax: new Prisma.Decimal(dto.tax),
          taxAmount: quoteTaxAmount,
          discount,
          shippingFee,
          total: quoteTotal,
          lineItems: {
            create: lineItems.map((item) => ({
              productName: item.productName,
              ourPrice: item.ourPrice,
              quantity: item.quantity,
            })),
          },
          paymentSchedule: {
            create: {
              type: paymentSchedule.type,
              totalAmount: paymentSchedule.totalAmount,
              items: {
                create: paymentSchedule.items.map((item) => ({
                  itemType: item.itemType,
                  name: item.name,
                  amountType: item.amountType,
                  percentage: item.percentage,
                  amount: item.amount,
                  dateType: item.dateType,
                  dueDate: item.dueDate,
                  position: item.position,
                })),
              },
            },
          },
        },
        select: quoteSelect,
      });

      await tx.commission.create({
        data: {
          quoteId: createdQuote.id,
          clientId: project.client.id,
          staffId: commissionStaffId,
          total: this.getCommissionBaseTotal(quoteTotal, quoteTaxAmount),
          percentageCommission: new Prisma.Decimal(0),
          amount: new Prisma.Decimal(0),
          status: autoApprove
            ? CommissionStatus.INVOICE_COMMISSION
            : CommissionStatus.QUOTED_COMMISSION,
        },
      });

      if (autoApprove) {
        const invoiceId = await this.invoiceIdGenerator.nextId(tx);
        const createdInvoice = await tx.invoice.create({
          data: {
            invoiceId,
            quoteId: createdQuote.id,
            projectId: dto.projectId,
            name: dto.name.trim(),
            status: QuoteStatus.APPROVED,
            message,
            clientComment: null,
            dateIssued,
            validUntil,
            subtotal: new Prisma.Decimal(dto.subtotal),
            tax: new Prisma.Decimal(dto.tax),
            taxAmount: quoteTaxAmount,
            discount,
            shippingFee,
            total: quoteTotal,
            lineItems: {
              create: lineItems.map((item) => ({
                productName: item.productName,
                ourPrice: item.ourPrice,
                quantity: item.quantity,
              })),
            },
          },
        });
        createdInvoiceId = createdInvoice.invoiceId;
        createdInvoiceDbId = createdInvoice.id;

        const billing = await this.getProjectBillingTotals(tx, dto.projectId);
        await tx.project.update({
          where: { id: dto.projectId },
          data: {
            status: ProjectStatus.IN_PRODUCTION,
            paymentStatus: this.resolveProjectPaymentStatus(
              billing.amountPaid,
              billing.totalInvoiced,
            ),
          },
        });

        return tx.quote.findUniqueOrThrow({
          where: { id: createdQuote.id },
          select: quoteSelect,
        });
      }

      await tx.project.update({
        where: { id: dto.projectId },
        data: {
          status: ProjectStatus.QUOTED,
        },
      });

      return createdQuote;
    });

    if (autoApprove && createdInvoiceId && createdInvoiceDbId) {
      const approvedQuote = await this.prisma.quote.findUnique({
        where: { id: quote.id },
        select: quoteApprovalSelect,
      });

      if (approvedQuote) {
        const invoiceMailContext = this.buildInvoiceCreatedMailContext(
          approvedQuote,
          createdInvoiceDbId,
          createdInvoiceId,
          null,
        );
        const notificationRecipients = this.getUniqueRecipients([
          {
            id: project.client.id,
            name: project.client.name,
            email: project.client.email,
          },
          project.client.accountPartner
            ? {
                id: project.client.accountPartner.id,
                name: project.client.accountPartner.name,
                email: project.client.accountPartner.email,
              }
            : null,
          ...(await this.getAdminRecipients([
            project.client.accountPartnerId,
          ])),
        ]);

        if (notificationRecipients.length) {
          void Promise.all(
            notificationRecipients.map((recipient) =>
              this.mail.sendInvoiceCreatedMail({
                ...invoiceMailContext,
                recipientName: recipient.name,
                recipientEmail: recipient.email,
              }),
            ),
          ).catch((error: unknown) => {
            this.logger.error(
              `Failed to send invoice creation notification for quote ${quote.id}`,
              error,
            );
          });
        }
      }
    } else {
      void this.mail
        .sendQuoteCreatedMail(this.buildQuoteCreatedMailContext(project, quote))
        .catch((error: unknown) => {
          this.logger.error(
            `Failed to send quote creation notification for quote ${quote.id}`,
            error,
          );
        });
    }

    return {
      message: autoApprove
        ? 'Quote approved and invoice created successfully'
        : 'Quote created successfully',
      quote: this.serializeQuote(quote),
    };
  }

  async updateQuote(id: string, dto: UpdateQuoteInput, user: IAuthUser) {
    const quote = await this.getQuoteForStaff(id, user);

    if (quote.status === QuoteStatus.APPROVED) {
      bad('Approved quotes cannot be edited');
    }

    const data: Prisma.QuoteUpdateInput = {};

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) bad('name is required');
      data.name = name;
    }

    if (dto.message !== undefined) {
      data.message = dto.message.trim() || null;
    }

    if (dto.quoteId !== undefined) {
      const quoteId = dto.quoteId.trim();
      if (!quoteId) bad('quoteId is required');
      data.quoteId = quoteId;
    }

    const { dateIssued, validUntil } = this.validateQuoteDates(
      dto.dateIssued ?? quote.dateIssued.toISOString(),
      dto.validUntil ?? quote.validUntil.toISOString(),
    );

    if (dto.dateIssued !== undefined) data.dateIssued = dateIssued;
    if (dto.validUntil !== undefined) data.validUntil = validUntil;
    if (dto.subtotal !== undefined)
      data.subtotal = new Prisma.Decimal(dto.subtotal);
    if (dto.tax !== undefined) data.tax = new Prisma.Decimal(dto.tax);
    if (dto.taxAmount !== undefined)
      data.taxAmount = this.toDecimal(dto.taxAmount, 'taxAmount');
    if (dto.discount !== undefined) {
      data.discount = this.toNonNegativeDecimal(dto.discount, 'discount');
    }
    if (dto.shippingFee !== undefined) {
      data.shippingFee = this.toNonNegativeDecimal(
        dto.shippingFee,
        'shippingFee',
      );
    }
    const nextTotal =
      dto.total !== undefined
        ? this.toDecimal(dto.total, 'total')
        : quote.total;
    const nextTaxAmount =
      dto.taxAmount !== undefined
        ? this.toDecimal(dto.taxAmount, 'taxAmount')
        : quote.taxAmount;
    if (dto.total !== undefined) data.total = nextTotal;

    const lineItems =
      dto.lineItems !== undefined
        ? await this.getCatalogLineItems(dto.lineItems)
        : null;

    if (
      dto.total !== undefined &&
      quote.paymentSchedule &&
      dto.paymentSchedule === undefined
    ) {
      bad(
        'paymentSchedule must be updated when changing the total of a quote that already has a payment schedule',
      );
    }

    const paymentSchedule =
      dto.paymentSchedule !== undefined
        ? this.validateAndNormalizePaymentSchedule(
            dto.paymentSchedule,
            nextTotal,
          )
        : null;

    if (!Object.keys(data).length && !lineItems && !paymentSchedule) {
      bad('At least one update field is required');
    }

    const resetWorkflow =
      quote.status === QuoteStatus.REJECTED ||
      quote.status === QuoteStatus.IN_REVIEW;
    const shouldSyncCommission =
      dto.total !== undefined ||
      dto.taxAmount !== undefined ||
      !quote.commission;

    const updatedQuote = await this.prisma.$transaction(async (tx) => {
      const nextQuote = await tx.quote.update({
        where: { id },
        data: {
          ...data,
          ...(resetWorkflow
            ? {
                status: QuoteStatus.PENDING,
                clientComment: null,
              }
            : {}),
          ...(lineItems
            ? {
                lineItems: {
                  deleteMany: {},
                  create: lineItems.map((item) => ({
                    productName: item.productName,
                    ourPrice: item.ourPrice,
                    quantity: item.quantity,
                  })),
                },
              }
            : {}),
          ...(paymentSchedule
            ? {
                paymentSchedule: {
                  upsert: {
                    create: {
                      type: paymentSchedule.type,
                      totalAmount: paymentSchedule.totalAmount,
                      items: {
                        create: paymentSchedule.items.map((item) => ({
                          itemType: item.itemType,
                          name: item.name,
                          amountType: item.amountType,
                          percentage: item.percentage,
                          amount: item.amount,
                          dateType: item.dateType,
                          dueDate: item.dueDate,
                          position: item.position,
                        })),
                      },
                    },
                    update: {
                      type: paymentSchedule.type,
                      totalAmount: paymentSchedule.totalAmount,
                      items: {
                        deleteMany: {},
                        create: paymentSchedule.items.map((item) => ({
                          itemType: item.itemType,
                          name: item.name,
                          amountType: item.amountType,
                          percentage: item.percentage,
                          amount: item.amount,
                          dateType: item.dateType,
                          dueDate: item.dueDate,
                          position: item.position,
                        })),
                      },
                    },
                  },
                },
              }
            : {}),
        },
        select: quoteSelect,
      });

      if (resetWorkflow || quote.project.status === ProjectStatus.LOST) {
        await tx.project.update({
          where: { id: quote.project.id },
          data: {
            status: ProjectStatus.QUOTED,
          },
        });
      }

      if (shouldSyncCommission) {
        await this.upsertQuoteCommission(tx, {
          quoteId: id,
          clientId: quote.project.client.id,
          staffId:
            quote.project.client.accountPartnerId ?? quote.commission?.staffId,
          total: nextTotal,
          taxAmount: nextTaxAmount,
          percentageCommission:
            quote.commission?.percentageCommission ?? new Prisma.Decimal(0),
          status:
            quote.commission?.status ?? CommissionStatus.QUOTED_COMMISSION,
        });
      }

      return nextQuote;
    });

    return {
      message: 'Quote updated successfully',
      quote: this.serializeQuote(updatedQuote),
    };
  }

  async respondToQuote(id: string, dto: RespondToQuoteInput, user: IAuthUser) {
    if (user.role !== Role.CLIENT) {
      bad('Only clients can respond to quotes', 403);
    }

    const quote = await this.prisma.quote.findFirst({
      where: {
        id,
        project: {
          clientId: user.id,
        },
      },
      select: quoteApprovalSelect,
    });

    if (!quote) bad('Quote not found', 404);

    if (quote.status === QuoteStatus.APPROVED) {
      bad('This quote has already been approved');
    }

    if (quote.status === QuoteStatus.REJECTED) {
      bad('This quote must be edited by staff before it can be reviewed again');
    }

    if (dto.status === QuoteStatus.PENDING) {
      bad('Clients can only approve, reject, or request review');
    }

    const comment = dto.comment?.trim() || null;
    if (
      (dto.status === QuoteStatus.REJECTED ||
        dto.status === QuoteStatus.IN_REVIEW) &&
      !comment
    ) {
      bad('comment is required when rejecting or reviewing a quote');
    }

    const projectStatus =
      dto.status === QuoteStatus.APPROVED
        ? ProjectStatus.IN_PRODUCTION
        : dto.status === QuoteStatus.REJECTED
          ? ProjectStatus.LOST
          : ProjectStatus.QUOTED;
    let createdInvoiceId: string | null = null;
    let createdInvoiceDbId: string | null = null;

    const updatedQuote = await this.prisma.$transaction(async (tx) => {
      if (dto.status === QuoteStatus.APPROVED) {
        if (
          !quote.project.client.accountPartnerId &&
          !quote.commission?.staffId
        ) {
          bad(
            'This quote cannot be approved because the client has no assigned staff user for commission',
          );
        }

        const invoiceId = await this.invoiceIdGenerator.nextId(tx);
        const createdInvoice = await tx.invoice.create({
          data: {
            invoiceId,
            quoteId: quote.id,
            projectId: quote.projectId,
            name: quote.name,
            status: QuoteStatus.APPROVED,
            message: quote.message,
            clientComment: comment,
            dateIssued: quote.dateIssued,
            validUntil: quote.validUntil,
            subtotal: quote.subtotal,
            tax: quote.tax,
            taxAmount: quote.taxAmount,
            discount: quote.discount,
            shippingFee: quote.shippingFee,
            total: quote.total,
            lineItems: {
              create: quote.lineItems.map((lineItem) => ({
                productName: lineItem.productName,
                ourPrice: lineItem.ourPrice,
                quantity: lineItem.quantity,
              })),
            },
          },
        });
        createdInvoiceId = createdInvoice.invoiceId;
        createdInvoiceDbId = createdInvoice.id;

        const billing = await this.getProjectBillingTotals(tx, quote.projectId);
        await tx.project.update({
          where: { id: quote.projectId },
          data: {
            status: projectStatus,
            paymentStatus: this.resolveProjectPaymentStatus(
              billing.amountPaid,
              billing.totalInvoiced,
            ),
          },
        });

        await this.upsertQuoteCommission(tx, {
          quoteId: quote.id,
          clientId: quote.project.client.id,
          staffId:
            quote.project.client.accountPartnerId ?? quote.commission?.staffId,
          total: quote.total,
          taxAmount: quote.taxAmount,
          percentageCommission:
            quote.commission?.percentageCommission ?? new Prisma.Decimal(0),
          status: CommissionStatus.INVOICE_COMMISSION,
        });
      } else {
        await tx.project.update({
          where: { id: quote.projectId },
          data: {
            status: projectStatus,
          },
        });
      }

      return tx.quote.update({
        where: { id },
        data: {
          status: dto.status,
          clientComment: comment,
        },
        select: quoteSelect,
      });
    });

    if (
      dto.status === QuoteStatus.APPROVED &&
      createdInvoiceId &&
      createdInvoiceDbId
    ) {
      const invoiceMailContext = this.buildInvoiceCreatedMailContext(
        quote,
        createdInvoiceDbId,
        createdInvoiceId,
        comment,
      );
      const notificationRecipients = this.getUniqueRecipients([
        {
          id: quote.project.client.id,
          name: quote.project.client.name,
          email: quote.project.client.email,
        },
        quote.project.client.accountPartner
          ? {
              id: quote.project.client.accountPartner.id,
              name: quote.project.client.accountPartner.name,
              email: quote.project.client.accountPartner.email,
            }
          : null,
        ...(await this.getAdminRecipients([
          quote.project.client.accountPartnerId,
        ])),
      ]);

      if (notificationRecipients.length) {
        void Promise.all(
          notificationRecipients.map((recipient) =>
            this.mail.sendInvoiceCreatedMail({
              ...invoiceMailContext,
              recipientName: recipient.name,
              recipientEmail: recipient.email,
            }),
          ),
        ).catch((error: unknown) => {
          this.logger.error(
            `Failed to send invoice creation notification for quote ${quote.id}`,
            error,
          );
        });
      }
    }

    return {
      message: 'Quote response recorded successfully',
      quote: this.serializeQuote(updatedQuote),
    };
  }

  private async getProjectForStaff(projectId: string, user: IAuthUser) {
    const project = await this.prisma.project.findUnique({
      where: { id: projectId },
      select: quoteProjectSelect,
    });

    if (!project) bad('Project not found', 404);

    if (!user.isAdmin && project.client.accountPartnerId !== user.id) {
      bad(
        'You can only manage quotes for projects assigned to your clients',
        403,
      );
    }

    return project;
  }

  private async getQuoteForStaff(id: string, user: IAuthUser) {
    const quote = await this.prisma.quote.findUnique({
      where: { id },
      select: {
        id: true,
        quoteId: true,
        status: true,
        dateIssued: true,
        validUntil: true,
        total: true,
        taxAmount: true,
        paymentSchedule: {
          select: {
            id: true,
          },
        },
        commission: {
          select: {
            staffId: true,
            percentageCommission: true,
            status: true,
          },
        },
        project: {
          select: {
            id: true,
            status: true,
            client: {
              select: {
                id: true,
                accountPartnerId: true,
              },
            },
          },
        },
      },
    });

    if (!quote) bad('Quote not found', 404);

    if (!user.isAdmin && quote.project.client.accountPartnerId !== user.id) {
      bad(
        'You can only manage quotes for projects assigned to your clients',
        403,
      );
    }

    return quote;
  }

  private getQuoteVisibilityWhere(user: IAuthUser): Prisma.QuoteWhereInput {
    if (user.role === Role.CLIENT) {
      return {
        project: {
          clientId: user.id,
        },
      };
    }

    if (user.isAdmin) {
      return {};
    }

    return {
      project: {
        client: {
          accountPartnerId: user.id,
        },
      },
    };
  }

  private getProjectVisibilityWhere(user: IAuthUser): Prisma.ProjectWhereInput {
    if (user.role === Role.CLIENT) {
      return {
        clientId: user.id,
      };
    }

    if (user.isAdmin) {
      return {};
    }

    return {
      client: {
        accountPartnerId: user.id,
      },
    };
  }

  private validateQuoteDates(dateIssuedValue: string, validUntilValue: string) {
    const dateIssued = this.toDate(dateIssuedValue, 'dateIssued');
    const validUntil = this.toDate(validUntilValue, 'validUntil');

    if (validUntil < dateIssued) {
      bad('validUntil must be on or after dateIssued');
    }

    return { dateIssued, validUntil };
  }

  private buildQuoteCreatedMailContext(
    project: QuoteProjectRecord,
    quote: QuoteRecord,
  ) {
    const paymentScheduleItems =
      quote.paymentSchedule?.items.map((item) => ({
        name: item.name,
        dueDate: formatScheduleDueDate(item),
        percentage: formatPercentage(item.percentage),
        amount: formatCurrency(item.amount),
      })) ?? [];

    return {
      recipientName: project.client.name,
      recipientEmail: project.client.email,
      projectName: project.name,
      quoteName: quote.name,
      quoteId: quote.quoteId,
      quoteDownloadUrl: this.buildPublicDownloadUrl(
        'quote',
        quote.id,
        project.client.email,
      ),
      total: formatCurrency(quote.total),
      dateIssued: formatDate(quote.dateIssued),
      validUntil: formatDate(quote.validUntil),
      clientCompany: project.client.company ?? null,
      clientPhone: project.client.phone ?? null,
      projectLocation: project.location ?? null,
      subtotal: formatCurrency(quote.subtotal),
      taxLabel: `Tax (${formatPercentage(quote.tax)})`,
      taxAmount: formatCurrency(quote.taxAmount),
      showTax: quote.taxAmount.greaterThan(0),
      discount: formatCurrency(quote.discount),
      showDiscount: quote.discount.greaterThan(0),
      shippingFee: formatCurrency(quote.shippingFee),
      showShippingFee: quote.shippingFee.greaterThan(0),
      lineItems: quote.lineItems.map((lineItem) => ({
        productName: lineItem.productName,
        quantity: lineItem.quantity,
        price: lineItem.ourPrice ? formatCurrency(lineItem.ourPrice) : null,
        amount: lineItem.ourPrice
          ? formatCurrency(lineItem.ourPrice.mul(lineItem.quantity))
          : null,
      })),
      paymentScheduleLabel: getPaymentScheduleLabel(
        quote.paymentSchedule?.type,
      ),
      paymentScheduleItems,
      hasPaymentSchedule: paymentScheduleItems.length > 0,
      contactName: project.client.accountPartner?.name ?? null,
      contactEmail: project.client.accountPartner?.email ?? null,
      message: quote.message,
    };
  }

  private buildInvoiceCreatedMailContext(
    quote: QuoteApprovalRecord,
    invoiceDbId: string,
    invoiceId: string,
    clientComment: string | null,
  ) {
    return {
      projectName: quote.project.name,
      quoteName: quote.name,
      quoteId: quote.quoteId,
      invoiceId,
      invoiceDownloadUrl: this.buildPublicDownloadUrl(
        'invoice',
        invoiceDbId,
        quote.project.client.email,
      ),
      total: formatCurrency(quote.total),
      dateIssued: formatDate(quote.dateIssued),
      validUntil: formatDate(quote.validUntil),
      customerName: quote.project.client.name,
      customerEmail: quote.project.client.email,
      additionalRecipientEmail: quote.project.client.additionalEmail ?? null,
      clientCompany: quote.project.client.company ?? null,
      clientPhone: quote.project.client.phone ?? null,
      projectLocation: quote.project.location ?? null,
      subtotal: formatCurrency(quote.subtotal),
      taxLabel: `Tax (${formatPercentage(quote.tax)})`,
      taxAmount: formatCurrency(quote.taxAmount),
      showTax: quote.taxAmount.greaterThan(0),
      discount: formatCurrency(quote.discount),
      showDiscount: quote.discount.greaterThan(0),
      shippingFee: formatCurrency(quote.shippingFee),
      showShippingFee: quote.shippingFee.greaterThan(0),
      lineItems: quote.lineItems.map((lineItem) => ({
        productName: lineItem.productName,
        quantity: lineItem.quantity,
        price: lineItem.ourPrice ? formatCurrency(lineItem.ourPrice) : null,
        amount: lineItem.ourPrice
          ? formatCurrency(lineItem.ourPrice.mul(lineItem.quantity))
          : null,
      })),
      contactName: quote.project.client.accountPartner?.name ?? null,
      contactEmail: quote.project.client.accountPartner?.email ?? null,
      message: quote.message,
      clientComment,
    };
  }

  private buildPublicDownloadUrl(
    kind: PublicDownloadKind,
    documentId: string,
    recipientEmail: string,
  ) {
    const token = this.createPublicDownloadToken(
      kind,
      documentId,
      recipientEmail,
    );
    const baseUrl = this.getPublicApiBaseUrl();
    const path =
      kind === 'quote'
        ? `/quotes/${documentId}/public-download`
        : `/quotes/invoices/${documentId}/public-download`;

    return `${baseUrl}${path}?token=${encodeURIComponent(token)}`;
  }

  private createPublicDownloadToken(
    kind: PublicDownloadKind,
    documentId: string,
    recipientEmail: string,
  ) {
    const payload: PublicDownloadTokenPayload & { email: string } = {
      type: 'document-download',
      kind,
      documentId,
      email: recipientEmail,
    };

    return this.jwtService.sign(payload, {
      secret: this.getPublicDownloadSecret(),
      expiresIn: (process.env.MAIL_DOWNLOAD_TOKEN_EXPIRES_IN ?? '14d') as any,
    });
  }

  private async verifyPublicDownloadToken(
    token: string | undefined,
    kind: PublicDownloadKind,
    documentId: string,
  ) {
    if (!token?.trim()) bad('download token is required');

    let payload: PublicDownloadTokenPayload;

    try {
      payload = await this.jwtService.verifyAsync<PublicDownloadTokenPayload>(
        token,
        {
          secret: this.getPublicDownloadSecret(),
        },
      );
    } catch {
      bad('Invalid or expired download link', 401);
    }

    if (
      payload.type !== 'document-download' ||
      payload.kind !== kind ||
      payload.documentId !== documentId
    ) {
      bad('Invalid download link', 403);
    }
  }

  private getPublicDownloadSecret() {
    const secret =
      process.env.MAIL_DOWNLOAD_TOKEN_SECRET ?? process.env.JWT_SECRET;

    if (!secret) {
      throw new Error(
        'MAIL_DOWNLOAD_TOKEN_SECRET or JWT_SECRET must be configured.',
      );
    }

    return secret;
  }

  private getPublicApiBaseUrl() {
    return process.env.API_BASE_URL;
  }

  private async getAdminRecipients(
    excludedIds: Array<string | null | undefined>,
  ) {
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

    return recipients.filter(
      (
        recipient,
      ): recipient is {
        id: string;
        name: string;
        email: string;
      } => {
        if (!recipient) return false;
        const key = recipient.email.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      },
    );
  }

  private validateAndNormalizePaymentSchedule(
    paymentSchedule: QuotePaymentScheduleInput,
    quoteTotal: Prisma.Decimal,
  ): NormalizedPaymentSchedule {
    const totalAmount = this.toDecimal(
      paymentSchedule.totalAmount,
      'paymentSchedule.totalAmount',
    );

    if (totalAmount.lessThanOrEqualTo(0)) {
      bad('paymentSchedule.totalAmount must be greater than 0');
    }

    this.assertDecimalClose(
      totalAmount,
      quoteTotal,
      'paymentSchedule.totalAmount must match the quote total',
    );

    switch (paymentSchedule.type) {
      case QuotePaymentScheduleType.FULL_PAYMENT: {
        if (!paymentSchedule.fullPayment) {
          bad('paymentSchedule.fullPayment is required for FULL_PAYMENT');
        }

        const fullPayment = this.normalizeSchedulePayment(
          paymentSchedule.fullPayment,
          'paymentSchedule.fullPayment',
          QuotePaymentScheduleItemType.FULL_PAYMENT,
          0,
        );

        this.assertDecimalClose(
          fullPayment.amount,
          totalAmount,
          'paymentSchedule.fullPayment.amount must match paymentSchedule.totalAmount',
        );
        this.assertDecimalClose(
          fullPayment.percentage,
          hundred,
          'paymentSchedule.fullPayment.percentage must be 100',
        );

        return {
          type: paymentSchedule.type,
          totalAmount,
          items: [fullPayment],
        };
      }

      case QuotePaymentScheduleType.DEPOSIT_AND_BALANCE: {
        if (!paymentSchedule.deposit) {
          bad('paymentSchedule.deposit is required for DEPOSIT_AND_BALANCE');
        }

        if (!paymentSchedule.balance) {
          bad('paymentSchedule.balance is required for DEPOSIT_AND_BALANCE');
        }

        const deposit = this.normalizeDepositPayment(
          paymentSchedule.deposit,
          totalAmount,
          0,
        );
        const balance = paymentSchedule.balance;

        if (!balance.name?.trim()) {
          bad(
            'paymentSchedule.balance.name is required for DEPOSIT_AND_BALANCE',
          );
        }

        if (!balance.date?.trim()) {
          bad(
            'paymentSchedule.balance.date is required for DEPOSIT_AND_BALANCE',
          );
        }

        if (balance.split) {
          bad(
            'paymentSchedule.balance.split must be false for DEPOSIT_AND_BALANCE',
          );
        }

        if (balance.payments?.length) {
          bad(
            'paymentSchedule.balance.payments are only allowed for DEPOSIT_AND_SPLIT_BALANCE',
          );
        }

        const normalizedBalance = this.normalizeSchedulePayment(
          {
            name: balance.name,
            amount: balance.amount,
            percentage: balance.percentage,
            date: balance.date,
          },
          'paymentSchedule.balance',
          QuotePaymentScheduleItemType.BALANCE,
          1,
        );

        this.assertDecimalClose(
          deposit.amount.add(normalizedBalance.amount),
          totalAmount,
          'paymentSchedule deposit and balance amounts must add up to paymentSchedule.totalAmount',
        );
        this.assertDecimalClose(
          deposit.percentage.add(normalizedBalance.percentage),
          hundred,
          'paymentSchedule deposit and balance percentages must add up to 100',
        );

        return {
          type: paymentSchedule.type,
          totalAmount,
          items: [deposit, normalizedBalance],
        };
      }

      case QuotePaymentScheduleType.DEPOSIT_AND_SPLIT_BALANCE: {
        if (!paymentSchedule.deposit) {
          bad(
            'paymentSchedule.deposit is required for DEPOSIT_AND_SPLIT_BALANCE',
          );
        }

        if (!paymentSchedule.balance) {
          bad(
            'paymentSchedule.balance is required for DEPOSIT_AND_SPLIT_BALANCE',
          );
        }

        const deposit = this.normalizeDepositPayment(
          paymentSchedule.deposit,
          totalAmount,
          0,
        );
        const balance = paymentSchedule.balance;

        if (balance.split !== true) {
          bad(
            'paymentSchedule.balance.split must be true for DEPOSIT_AND_SPLIT_BALANCE',
          );
        }

        if (balance.date) {
          bad(
            'paymentSchedule.balance.date is not allowed when the balance is split',
          );
        }

        if (balance.name) {
          bad(
            'paymentSchedule.balance.name is not allowed when the balance is split',
          );
        }

        if (!balance.payments?.length) {
          bad(
            'paymentSchedule.balance.payments is required for DEPOSIT_AND_SPLIT_BALANCE',
          );
        }

        if (balance.payments.length < 2) {
          bad(
            'paymentSchedule.balance.payments must contain at least two items when the balance is split',
          );
        }

        const balanceAmount = this.toDecimal(
          balance.amount,
          'paymentSchedule.balance.amount',
        );
        const balancePercentage = this.toDecimal(
          balance.percentage,
          'paymentSchedule.balance.percentage',
        );

        if (balanceAmount.lessThanOrEqualTo(0)) {
          bad('paymentSchedule.balance.amount must be greater than 0');
        }

        this.assertDecimalClose(
          deposit.amount.add(balanceAmount),
          totalAmount,
          'paymentSchedule deposit amount and split balance amount must add up to paymentSchedule.totalAmount',
        );
        this.assertDecimalClose(
          deposit.percentage.add(balancePercentage),
          hundred,
          'paymentSchedule deposit percentage and split balance percentage must add up to 100',
        );

        const splitPayments = balance.payments.map((item, index) =>
          this.normalizeSchedulePayment(
            item,
            `paymentSchedule.balance.payments[${index}]`,
            QuotePaymentScheduleItemType.SPLIT_PAYMENT,
            index + 1,
          ),
        );

        const splitAmountTotal = splitPayments.reduce(
          (sum, item) => sum.add(item.amount),
          new Prisma.Decimal(0),
        );
        const splitPercentageTotal = splitPayments.reduce(
          (sum, item) => sum.add(item.percentage),
          new Prisma.Decimal(0),
        );

        this.assertDecimalClose(
          splitAmountTotal,
          balanceAmount,
          'paymentSchedule.balance.payments amounts must add up to paymentSchedule.balance.amount',
        );
        this.assertDecimalClose(
          splitPercentageTotal,
          hundred,
          'paymentSchedule.balance.payments percentages must add up to 100',
        );

        splitPayments.forEach((item, index) => {
          const expectedAmount = balanceAmount
            .mul(item.percentage)
            .div(hundred);
          this.assertDecimalClose(
            item.amount,
            expectedAmount,
            `paymentSchedule.balance.payments[${index}].amount must match its percentage of the split balance`,
          );
        });

        return {
          type: paymentSchedule.type,
          totalAmount,
          items: [deposit, ...splitPayments],
        };
      }

      default:
        bad('Unsupported paymentSchedule.type value');
    }
  }

  private normalizeDepositPayment(
    deposit: NonNullable<QuotePaymentScheduleInput['deposit']>,
    totalAmount: Prisma.Decimal,
    position: number,
  ): NormalizedPaymentScheduleItem {
    const amountType = this.normalizeAmountType(
      deposit.amountType,
      'paymentSchedule.deposit.amountType',
    );
    const normalizedDeposit = this.normalizeSchedulePayment(
      deposit,
      'paymentSchedule.deposit',
      QuotePaymentScheduleItemType.DEPOSIT,
      position,
      amountType,
    );
    const expectedAmount = totalAmount
      .mul(normalizedDeposit.percentage)
      .div(hundred);

    this.assertDecimalClose(
      normalizedDeposit.amount,
      expectedAmount,
      'paymentSchedule.deposit.amount must match its percentage of paymentSchedule.totalAmount',
    );

    return normalizedDeposit;
  }

  private normalizeSchedulePayment(
    payment: {
      name: string;
      amount: number;
      percentage: number;
      date: string;
    },
    fieldPath: string,
    itemType: QuotePaymentScheduleItemType,
    position: number,
    amountType: QuotePaymentScheduleAmountType | null = null,
  ): NormalizedPaymentScheduleItem {
    const name = payment.name.trim();
    if (!name) {
      bad(`${fieldPath}.name is required`);
    }

    const amount = this.toDecimal(payment.amount, `${fieldPath}.amount`);
    if (amount.lessThanOrEqualTo(0)) {
      bad(`${fieldPath}.amount must be greater than 0`);
    }

    const percentage = this.toDecimal(
      payment.percentage,
      `${fieldPath}.percentage`,
    );
    if (percentage.lessThanOrEqualTo(0)) {
      bad(`${fieldPath}.percentage must be greater than 0`);
    }

    const { dateType, dueDate } = this.toScheduleDate(
      payment.date,
      `${fieldPath}.date`,
    );

    return {
      itemType,
      name,
      amountType,
      percentage,
      amount,
      dateType,
      dueDate,
      position,
    };
  }

  private normalizeAmountType(
    value: string,
    fieldPath: string,
  ): QuotePaymentScheduleAmountType {
    if (value === 'fixed') {
      return QuotePaymentScheduleAmountType.FIXED;
    }

    if (value === 'percentage') {
      return QuotePaymentScheduleAmountType.PERCENTAGE;
    }

    bad(`${fieldPath} must be either fixed or percentage`);
  }

  private assertDecimalClose(
    actual: Prisma.Decimal,
    expected: Prisma.Decimal,
    message: string,
  ) {
    if (actual.sub(expected).abs().greaterThan(decimalTolerance)) {
      bad(message);
    }
  }

  private toDecimal(value: number, fieldName: string) {
    if (!Number.isFinite(value)) {
      bad(`${fieldName} must be a valid number`);
    }

    return new Prisma.Decimal(String(value));
  }

  private toNonNegativeDecimal(value: number, fieldName: string) {
    const decimal = this.toDecimal(value, fieldName);

    if (decimal.lessThan(0)) {
      bad(`${fieldName} must be greater than or equal to 0`);
    }

    return decimal;
  }

  private toScheduleDate(value: string, fieldName: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      bad(`${fieldName} is required`);
    }

    if (trimmed.toLowerCase() === invoiceGenerationLabel.toLowerCase()) {
      return {
        dateType: QuotePaymentScheduleDateType.INVOICE_GENERATION,
        dueDate: null,
      };
    }

    return {
      dateType: QuotePaymentScheduleDateType.FIXED_DATE,
      dueDate: this.toDate(trimmed, fieldName),
    };
  }

  private toDate(value: string, fieldName: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      bad(`${fieldName} is required`);
    }

    const normalizedDate = this.parseSlashDate(trimmed);
    if (normalizedDate) {
      return normalizedDate;
    }

    const parsed = new Date(trimmed);
    if (Number.isNaN(parsed.getTime())) {
      bad(`Invalid ${fieldName} value`);
    }
    return parsed;
  }

  private parseSlashDate(value: string) {
    const match = value.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
    if (!match) {
      return null;
    }

    const year = Number(match[1]);
    const first = Number(match[2]);
    const second = Number(match[3]);

    let month = first;
    let day = second;

    if (first > 12 && second <= 12) {
      day = first;
      month = second;
    }

    const parsed = new Date(Date.UTC(year, month - 1, day));

    if (
      month < 1 ||
      month > 12 ||
      day < 1 ||
      day > 31 ||
      parsed.getUTCFullYear() !== year ||
      parsed.getUTCMonth() !== month - 1 ||
      parsed.getUTCDate() !== day
    ) {
      return null;
    }

    return parsed;
  }

  private async getProjectBillingTotals(
    tx: Prisma.TransactionClient,
    projectId: string,
  ) {
    const [invoiceAggregate, paymentAggregate] = await Promise.all([
      tx.invoice.aggregate({
        where: { projectId },
        _sum: {
          total: true,
        },
      }),
      tx.payment.aggregate({
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

  private resolveProjectPaymentStatus(
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

  private async upsertQuoteCommission(
    tx: Prisma.TransactionClient,
    input: {
      quoteId: string;
      clientId: string;
      staffId?: string | null;
      total: Prisma.Decimal;
      taxAmount: Prisma.Decimal;
      percentageCommission: Prisma.Decimal;
      status: CommissionStatus;
    },
  ) {
    if (!input.staffId) {
      bad(
        'This quote cannot be processed because the client has no assigned staff user for commission',
      );
    }

    const total = this.getCommissionBaseTotal(input.total, input.taxAmount);
    const amount = this.calculateCommissionAmount(
      total,
      input.percentageCommission,
    );

    return tx.commission.upsert({
      where: {
        quoteId: input.quoteId,
      },
      create: {
        quoteId: input.quoteId,
        clientId: input.clientId,
        staffId: input.staffId,
        total,
        percentageCommission: input.percentageCommission,
        amount,
        status: input.status,
      },
      update: {
        clientId: input.clientId,
        staffId: input.staffId,
        total,
        amount,
        status: input.status,
      },
    });
  }

  private getCommissionBaseTotal(
    total: Prisma.Decimal,
    taxAmount: Prisma.Decimal,
  ) {
    return total.sub(taxAmount);
  }

  private calculateCommissionAmount(
    total: Prisma.Decimal,
    percentageCommission: Prisma.Decimal,
  ) {
    return total.mul(percentageCommission).div(hundred);
  }

  private async getCatalogLineItems(lineItems: QuoteLineItemInput[]) {
    const uniqueIds = [
      ...new Set(
        lineItems
          .map((item) => item.serviceId)
          .filter((serviceId): serviceId is string => Boolean(serviceId)),
      ),
    ];
    const catalogItems = uniqueIds.length
      ? await this.prisma.catalogItem.findMany({
          where: {
            id: {
              in: uniqueIds,
            },
            active: true,
          },
          select: {
            id: true,
            productName: true,
            ourPrice: true,
          },
        })
      : [];

    if (catalogItems.length !== uniqueIds.length) {
      bad('One or more selected services were not found or are inactive');
    }

    const itemMap = new Map(catalogItems.map((item) => [item.id, item]));
    return lineItems.map((lineItem) => {
      if (!lineItem.serviceId) {
        return {
          productName: lineItem.productName!.trim(),
          ourPrice:
            lineItem.ourPrice !== undefined
              ? this.toNonNegativeDecimal(
                  lineItem.ourPrice,
                  'lineItems.ourPrice',
                )
              : null,
          quantity: lineItem.quantity,
        };
      }

      const item = itemMap.get(lineItem.serviceId);
      if (!item)
        bad('One or more selected services were not found or are inactive');
      return {
        productName: item.productName,
        ourPrice: item.ourPrice,
        quantity: lineItem.quantity,
      };
    });
  }

  private serializePaymentSchedule(
    paymentSchedule: QuoteRecord['paymentSchedule'],
  ) {
    if (!paymentSchedule) {
      return null;
    }

    const deposit = paymentSchedule.items.find(
      (item) => item.itemType === QuotePaymentScheduleItemType.DEPOSIT,
    );
    const balance = paymentSchedule.items.find(
      (item) => item.itemType === QuotePaymentScheduleItemType.BALANCE,
    );
    const fullPayment = paymentSchedule.items.find(
      (item) => item.itemType === QuotePaymentScheduleItemType.FULL_PAYMENT,
    );
    const splitPayments = paymentSchedule.items.filter(
      (item) => item.itemType === QuotePaymentScheduleItemType.SPLIT_PAYMENT,
    );

    switch (paymentSchedule.type) {
      case QuotePaymentScheduleType.FULL_PAYMENT:
        return {
          type: paymentSchedule.type,
          totalAmount: paymentSchedule.totalAmount.toString(),
          fullPayment: fullPayment
            ? this.serializeScheduleItem(fullPayment)
            : null,
        };

      case QuotePaymentScheduleType.DEPOSIT_AND_BALANCE:
        return {
          type: paymentSchedule.type,
          totalAmount: paymentSchedule.totalAmount.toString(),
          deposit: deposit ? this.serializeDepositScheduleItem(deposit) : null,
          balance: balance ? this.serializeBalanceScheduleItem(balance) : null,
        };

      case QuotePaymentScheduleType.DEPOSIT_AND_SPLIT_BALANCE: {
        const splitAmount = splitPayments.reduce(
          (sum, item) => sum.add(item.amount),
          new Prisma.Decimal(0),
        );
        const splitPercentage = paymentSchedule.totalAmount.greaterThan(0)
          ? splitAmount.mul(hundred).div(paymentSchedule.totalAmount)
          : new Prisma.Decimal(0);

        return {
          type: paymentSchedule.type,
          totalAmount: paymentSchedule.totalAmount.toString(),
          deposit: deposit ? this.serializeDepositScheduleItem(deposit) : null,
          balance: {
            amount: splitAmount.toString(),
            percentage: splitPercentage.toString(),
            split: true,
            payments: splitPayments.map((item) =>
              this.serializeScheduleItem(item),
            ),
          },
        };
      }
    }
  }

  private serializeDepositScheduleItem(item: PaymentScheduleItemRecord) {
    return {
      ...this.serializeScheduleItem(item),
      amountType:
        item.amountType === QuotePaymentScheduleAmountType.FIXED
          ? 'fixed'
          : 'percentage',
    };
  }

  private serializeBalanceScheduleItem(item: PaymentScheduleItemRecord) {
    return this.serializeScheduleItem(item);
  }

  private serializeScheduleItem(item: PaymentScheduleItemRecord) {
    return {
      name: item.name,
      amount: item.amount.toString(),
      percentage: item.percentage.toString(),
      date:
        item.dateType === QuotePaymentScheduleDateType.INVOICE_GENERATION
          ? invoiceGenerationLabel
          : (item.dueDate?.toISOString() ?? invoiceGenerationLabel),
    };
  }

  private serializeQuote(quote: QuoteRecord) {
    return {
      id: quote.id,
      name: quote.name,
      quoteId: quote.quoteId,
      status: quote.status,
      message: quote.message,
      clientComment: quote.clientComment,
      dateIssued: quote.dateIssued.toISOString(),
      validUntil: quote.validUntil.toISOString(),
      subtotal: quote.subtotal.toString(),
      tax: quote.tax.toString(),
      taxAmount: quote.taxAmount.toString(),
      discount: quote.discount.toString(),
      shippingFee: quote.shippingFee.toString(),
      total: quote.total.toString(),
      project: {
        id: quote.project.id,
        name: quote.project.name,
        status: quote.project.status,
        clientId: quote.project.clientId,
      },
      lineItems: quote.lineItems.map((lineItem) => ({
        id: lineItem.id,
        productName: lineItem.productName,
        ourPrice: lineItem.ourPrice?.toString() ?? null,
        quantity: lineItem.quantity,
        lineTotal: lineItem.ourPrice?.mul(lineItem.quantity).toString() ?? null,
      })),
      paymentSchedule: this.serializePaymentSchedule(quote.paymentSchedule),
      invoices: quote.invoices.map((invoice) => ({
        id: invoice.id,
        invoiceId: invoice.invoiceId,
        status: invoice.status,
        total: invoice.total.toString(),
        payments: invoice.payments.map((payment) => ({
          id: payment.id,
          createdAt: payment.createdAt.toISOString(),
          method: payment.method,
          reference: payment.reference,
          amount: payment.amount.toString(),
        })),
        createdAt: invoice.createdAt.toISOString(),
      })),
      createdAt: quote.createdAt.toISOString(),
      updatedAt: quote.updatedAt.toISOString(),
    };
  }
}
