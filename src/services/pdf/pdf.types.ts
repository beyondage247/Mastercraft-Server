export interface PdfDocumentLineItem {
  productName: string;
  quantity: number;
  unitPrice: string | null;
  amount: string | null;
}

export interface PdfPaymentScheduleRow {
  name: string;
  dueDate: string;
  percentage: string;
  amount: string;
}

export interface PdfPaymentLogRow {
  date: string;
  method: string;
  reference: string;
  amount: string;
}

interface DocumentPdfDataBase {
  docNumber: string;
  dateIssued: string;
  validUntil: string;
  projectName: string;
  projectLocation: string | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  clientCompany: string | null;
  lineItems: PdfDocumentLineItem[];
  subtotal: string;
  taxLabel: string;
  taxAmount: string;
  showTax: boolean;
  discount: string;
  showDiscount: boolean;
  shippingFee: string;
  showShippingFee: boolean;
  total: string;
  message: string | null;
  clientComment: string | null;
}

export interface QuotePdfData extends DocumentPdfDataBase {
  paymentSchedule: PdfPaymentScheduleRow[];
}

export interface InvoicePdfData extends DocumentPdfDataBase {
  quoteId: string;
  amountPaid: string;
  balanceDue: string;
  payments: PdfPaymentLogRow[];
}
