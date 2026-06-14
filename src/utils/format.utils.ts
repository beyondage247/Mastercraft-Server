import {
  PaymentMethod,
  Prisma,
  QuotePaymentScheduleDateType,
  QuotePaymentScheduleType,
} from '@prisma/client';

export const invoiceGenerationLabel = 'Date of Invoice Generation';

export function formatDate(value: Date) {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(value);
}

export function formatCurrency(value: Prisma.Decimal) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value.toString()));
}

export function formatPercentage(value: Prisma.Decimal) {
  return `${new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(Number(value.toString()))}%`;
}

export function getPaymentScheduleLabel(
  type: QuotePaymentScheduleType | null | undefined,
) {
  switch (type) {
    case QuotePaymentScheduleType.FULL_PAYMENT:
      return 'Full Payment';
    case QuotePaymentScheduleType.DEPOSIT_AND_BALANCE:
      return 'Deposit and Balance';
    case QuotePaymentScheduleType.DEPOSIT_AND_SPLIT_BALANCE:
      return 'Deposit and Split Balance';
    default:
      return null;
  }
}

export function formatPaymentMethod(method: PaymentMethod) {
  return method
    .split('_')
    .map((word) =>
      word.length <= 3
        ? word
        : `${word[0]}${word.slice(1).toLowerCase()}`,
    )
    .join(' ');
}

export function formatScheduleDueDate(item: {
  dateType: QuotePaymentScheduleDateType;
  dueDate: Date | null;
}) {
  if (item.dateType === QuotePaymentScheduleDateType.INVOICE_GENERATION) {
    return invoiceGenerationLabel;
  }

  if (!item.dueDate) {
    return invoiceGenerationLabel;
  }

  return formatDate(item.dueDate);
}
