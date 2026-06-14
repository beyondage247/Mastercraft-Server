import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class NewStaffMailInput {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  tempPassword: string;
}

export class NewClientMailInput {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  tempPassword: string;

  @IsString()
  company: string;

  @IsString()
  phone: string;
}

export class ProjectCommentMailInput {
  @IsString()
  recipientName: string;

  @IsEmail()
  recipientEmail: string;

  @IsString()
  projectName: string;

  @IsString()
  commenterName: string;

  @IsString()
  commenterRole: string;

  @IsString()
  message: string;
}

export class ProjectAttachmentMailInput {
  @IsString()
  recipientName: string;

  @IsEmail()
  recipientEmail: string;

  @IsString()
  projectName: string;

  @IsString()
  uploaderName: string;

  @IsString()
  uploaderRole: string;

  @IsString()
  documentNames: string;
}

export class ProjectCreatedMailInput {
  @IsString()
  recipientName: string;

  @IsEmail()
  recipientEmail: string;

  @IsString()
  projectName: string;

  @IsString()
  location: string;

  @IsString()
  description: string;

  @IsString()
  fabrication: string;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;
}

export class ProjectUpdatedMailInput {
  @IsString()
  recipientName: string;

  @IsEmail()
  recipientEmail: string;

  @IsString()
  projectName: string;

  @IsString()
  location: string;

  @IsString()
  description: string;

  @IsString()
  fabrication: string;

  @IsString()
  startDate: string;

  @IsString()
  endDate: string;

  @IsString()
  projectStatus: string;

  @IsString()
  updatedSummary: string;
}

export class QuoteCreatedMailInput {
  @IsString()
  recipientName: string;

  @IsEmail()
  recipientEmail: string;

  @IsString()
  projectName: string;

  @IsString()
  quoteName: string;

  @IsString()
  quoteId: string;

  @IsString()
  quoteDownloadUrl: string;

  @IsString()
  total: string;

  @IsString()
  dateIssued: string;

  @IsString()
  validUntil: string;

  @IsOptional()
  @IsString()
  clientCompany?: string | null;

  @IsOptional()
  @IsString()
  clientPhone?: string | null;

  @IsOptional()
  @IsString()
  projectLocation?: string | null;

  @IsString()
  subtotal: string;

  @IsString()
  taxLabel: string;

  @IsString()
  taxAmount: string;

  @IsBoolean()
  showTax: boolean;

  @IsString()
  discount: string;

  @IsBoolean()
  showDiscount: boolean;

  @IsString()
  shippingFee: string;

  @IsBoolean()
  showShippingFee: boolean;

  @IsArray()
  lineItems: QuoteCreatedMailLineItemInput[];

  @IsOptional()
  @IsString()
  paymentScheduleLabel?: string | null;

  @IsArray()
  paymentScheduleItems: QuoteCreatedMailPaymentScheduleItemInput[];

  @IsBoolean()
  hasPaymentSchedule: boolean;

  @IsOptional()
  @IsString()
  contactName?: string | null;

  @IsOptional()
  @IsString()
  contactEmail?: string | null;

  @IsOptional()
  @IsString()
  message?: string | null;
}

export class QuoteCreatedMailLineItemInput {
  @IsString()
  productName: string;

  @IsInt()
  @Min(1)
  quantity: number;

  @IsOptional()
  @IsString()
  price?: string | null;

  @IsOptional()
  @IsString()
  amount?: string | null;
}

export class QuoteCreatedMailPaymentScheduleItemInput {
  @IsString()
  name: string;

  @IsString()
  dueDate: string;

  @IsString()
  percentage: string;

  @IsString()
  amount: string;
}

export class InvoiceCreatedMailInput {
  @IsString()
  recipientName: string;

  @IsEmail()
  recipientEmail: string;

  @IsString()
  projectName: string;

  @IsString()
  quoteName: string;

  @IsString()
  quoteId: string;

  @IsString()
  invoiceId: string;

  @IsString()
  invoiceDownloadUrl: string;

  @IsString()
  total: string;

  @IsString()
  dateIssued: string;

  @IsString()
  validUntil: string;

  @IsString()
  customerName: string;

  @IsString()
  customerEmail: string;

  @IsOptional()
  @IsString()
  additionalRecipientEmail?: string | null;

  @IsOptional()
  @IsString()
  clientCompany?: string | null;

  @IsOptional()
  @IsString()
  clientPhone?: string | null;

  @IsOptional()
  @IsString()
  projectLocation?: string | null;

  @IsString()
  subtotal: string;

  @IsString()
  taxLabel: string;

  @IsString()
  taxAmount: string;

  @IsBoolean()
  showTax: boolean;

  @IsString()
  discount: string;

  @IsBoolean()
  showDiscount: boolean;

  @IsString()
  shippingFee: string;

  @IsBoolean()
  showShippingFee: boolean;

  @IsArray()
  lineItems: QuoteCreatedMailLineItemInput[];

  @IsOptional()
  @IsString()
  contactName?: string | null;

  @IsOptional()
  @IsString()
  contactEmail?: string | null;

  @IsOptional()
  @IsString()
  message?: string | null;

  @IsOptional()
  @IsString()
  clientComment?: string | null;
}

export class PasswordResetOtpMailInput {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @IsString()
  otp: string;

  @IsInt()
  @Min(1)
  expiresInMinutes: number;
}
