import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PaymentMethod,
  ProjectStatus,
  QuotePaymentScheduleType,
  QuoteStatus,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';

export class QuoteLineItemInput {
  @ApiPropertyOptional({
    example: '8f1e52bc-5a3c-4f5b-8f80-51f0b4649224',
    description:
      'Unique identifier for the service being snapshotted into the quote. Omit this and provide productName instead to add a custom line item that is not in the service catalog.',
  })
  @ValidateIf((o: QuoteLineItemInput) => o.serviceId !== undefined)
  @IsUUID()
  serviceId?: string;

  @ApiPropertyOptional({
    example: 'Custom Trim Work',
    description:
      'Display name for a custom line item that is not in the service catalog. Required when serviceId is not provided.',
  })
  @ValidateIf((o: QuoteLineItemInput) => o.serviceId === undefined)
  @IsString()
  @IsNotEmpty()
  productName?: string;

  @ApiPropertyOptional({
    example: 350,
    description:
      'Unit price for a custom line item. Only used when serviceId is not provided.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  ourPrice?: number;

  @ApiProperty({
    example: 2,
    description: 'Quantity requested for this quote line item.',
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  quantity: number;
}

const paymentScheduleDateDescription =
  'Use "Date of Invoice Generation" or any valid date string such as 2026-06-30.';

export class QuotePaymentSchedulePaymentInput {
  @ApiProperty({
    example: 'Payment 1',
    description: 'Display label for this scheduled payment.',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 800,
    description: 'Amount due for this payment.',
  })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({
    example: 50,
    description:
      'Percentage share of this payment within the balance being split.',
  })
  @IsNumber()
  @Min(0)
  percentage: number;

  @ApiProperty({
    example: '2026-06-15',
    description: paymentScheduleDateDescription,
  })
  @IsString()
  date: string;
}

export class QuotePaymentScheduleFullPaymentInput {
  @ApiProperty({
    example: 'Full Payment',
    description: 'Display label for the full payment row.',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 2000,
    description: 'Full amount due.',
  })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({
    example: 100,
    description: 'Percentage of the full payment. This must be 100.',
  })
  @IsNumber()
  @Min(0)
  percentage: number;

  @ApiProperty({
    example: '2026-06-30',
    description: paymentScheduleDateDescription,
  })
  @IsString()
  date: string;
}

export class QuotePaymentScheduleDepositInput {
  @ApiProperty({
    example: 'Deposit',
    description: 'Display label for the deposit row.',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'percentage',
    description:
      'How the deposit is defined. Allowed values: fixed, percentage.',
  })
  @IsIn(['fixed', 'percentage'])
  amountType: 'fixed' | 'percentage';

  @ApiProperty({
    example: 20,
    description: 'Deposit share of the quote total, expressed as a percentage.',
  })
  @IsNumber()
  @Min(0)
  percentage: number;

  @ApiProperty({
    example: 400,
    description: 'Deposit amount due.',
  })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({
    example: 'Date of Invoice Generation',
    description: paymentScheduleDateDescription,
  })
  @IsString()
  date: string;
}

export class QuotePaymentScheduleBalanceInput {
  @ApiPropertyOptional({
    example: 'Balance',
    description:
      'Display label for the balance row. Required when the balance is not split.',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({
    example: 1600,
    description: 'Remaining balance amount due after the deposit.',
  })
  @IsNumber()
  @Min(0.01)
  amount: number;

  @ApiProperty({
    example: 80,
    description: 'Remaining balance share of the quote total.',
  })
  @IsNumber()
  @Min(0)
  percentage: number;

  @ApiPropertyOptional({
    example: '2026-06-30',
    description:
      'Due date for the balance when it is not split into installments.',
  })
  @IsOptional()
  @IsString()
  date?: string;

  @ApiPropertyOptional({
    example: true,
    description:
      'Whether the balance is split into multiple scheduled payments.',
  })
  @IsOptional()
  @IsBoolean()
  split?: boolean;

  @ApiPropertyOptional({
    type: () => QuotePaymentSchedulePaymentInput,
    isArray: true,
    example: [
      {
        name: 'Payment 1',
        amount: 800,
        percentage: 50,
        date: '2026-06-15',
      },
      {
        name: 'Payment 2',
        amount: 800,
        percentage: 50,
        date: '2026-06-30',
      },
    ],
    description:
      'Installments that make up the remaining balance when split is true.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuotePaymentSchedulePaymentInput)
  payments?: QuotePaymentSchedulePaymentInput[];
}

export class QuotePaymentScheduleInput {
  @ApiProperty({
    enum: QuotePaymentScheduleType,
    enumName: 'QuotePaymentScheduleType',
    example: QuotePaymentScheduleType.DEPOSIT_AND_SPLIT_BALANCE,
    description:
      'Payment schedule mode. Allowed values: FULL_PAYMENT, DEPOSIT_AND_BALANCE, DEPOSIT_AND_SPLIT_BALANCE.',
  })
  @IsEnum(QuotePaymentScheduleType)
  type: QuotePaymentScheduleType;

  @ApiProperty({
    example: 2000,
    description:
      'Total amount covered by this payment schedule. This must match the quote total.',
  })
  @IsNumber()
  @Min(0.01)
  totalAmount: number;

  @ApiPropertyOptional({
    type: () => QuotePaymentScheduleFullPaymentInput,
    description: 'Provide this object when type is FULL_PAYMENT.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuotePaymentScheduleFullPaymentInput)
  fullPayment?: QuotePaymentScheduleFullPaymentInput;

  @ApiPropertyOptional({
    type: () => QuotePaymentScheduleDepositInput,
    description: 'Provide this object when type uses a deposit.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuotePaymentScheduleDepositInput)
  deposit?: QuotePaymentScheduleDepositInput;

  @ApiPropertyOptional({
    type: () => QuotePaymentScheduleBalanceInput,
    description:
      'Provide this object when type includes a post-deposit balance.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuotePaymentScheduleBalanceInput)
  balance?: QuotePaymentScheduleBalanceInput;
}

export class CreateQuoteInput {
  @ApiProperty({
    example: '6f870b4d-60f4-4b6d-a75a-6fc6240ce788',
    description: 'Unique identifier for the project this quote belongs to.',
  })
  @IsUUID()
  projectId: string;

  @ApiProperty({
    example: 'Solar Panel Installation',
    description: 'Display name for the quote.',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example:
      'Doors to be solid core Masonite Carrara unless otherwise specified.',
    description:
      'Optional message to include in the quote email and carry over to the invoice when the quote is approved.',
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiProperty({
    example: 'May 17, 2026',
    description:
      'Date the quote was issued. Any valid date string is accepted.',
  })
  @IsString()
  dateIssued: string;

  @ApiProperty({
    example: 'May 31, 2026',
    description: 'Date until which the quote remains valid.',
  })
  @IsString()
  validUntil: string;

  @ApiProperty({
    example: 4200,
    description: 'Subtotal before tax.',
  })
  @IsNumber()
  subtotal: number;

  @ApiProperty({
    example: 8,
    description: 'Tax rate or tax percentage value.',
  })
  @IsNumber()
  tax: number;

  @ApiProperty({
    example: 89,
    description: 'Computed tax amount.',
  })
  @IsNumber()
  taxAmount: number;

  @ApiPropertyOptional({
    example: 150,
    description: 'Optional discount amount applied to the quote.',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({
    example: 75,
    description: 'Optional shipping fee applied to the quote.',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingFee?: number;

  @ApiProperty({
    example: 4289,
    description: 'Grand total including tax.',
  })
  @IsNumber()
  total: number;

  @ApiProperty({
    type: () => QuoteLineItemInput,
    isArray: true,
    example: [
      {
        serviceId: '8f1e52bc-5a3c-4f5b-8f80-51f0b4649224',
        quantity: 2,
      },
      {
        serviceId: '44b4eb0d-8431-4224-9b98-2f350f0be93a',
        quantity: 1,
      },
      {
        productName: 'Custom Trim Work',
        ourPrice: 350,
        quantity: 1,
      },
    ],
    description:
      'Services selected for this quote. Their productName and ourPrice are snapshotted into the quote line items together with the requested quantity. Provide productName (and optionally ourPrice) instead of serviceId to add a custom line item that is not in the service catalog.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuoteLineItemInput)
  lineItems: QuoteLineItemInput[];

  @ApiProperty({
    type: () => QuotePaymentScheduleInput,
    description:
      'Payment schedule captured together with the quote. Supports full payment, deposit plus balance, or deposit plus split balance.',
  })
  @ValidateNested()
  @Type(() => QuotePaymentScheduleInput)
  paymentSchedule: QuotePaymentScheduleInput;

  @ApiPropertyOptional({
    example: false,
    description:
      'When true, the quote is immediately approved and an invoice is created in a single step. The client does not need to approve the quote and can proceed directly to payment.',
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  autoApprove?: boolean;
}

export class UpdateQuoteInput {
  @ApiPropertyOptional({
    example: 'Solar Panel Installation',
    description: 'Updated display name for the quote.',
  })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiPropertyOptional({
    example:
      'Doors to be solid core Masonite Carrara unless otherwise specified.',
    description:
      'Updated message to include in the quote email and future invoice email. Send an empty string to clear it.',
  })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({
    example: 'QT-2026-00001',
    description: 'Updated human-readable quote identifier.',
  })
  @IsOptional()
  @IsString()
  quoteId?: string;

  @ApiPropertyOptional({
    example: 'May 17, 2026',
    description: 'Updated issue date. Any valid date string is accepted.',
  })
  @IsOptional()
  @IsString()
  dateIssued?: string;

  @ApiPropertyOptional({
    example: 'May 31, 2026',
    description: 'Updated validity end date.',
  })
  @IsOptional()
  @IsString()
  validUntil?: string;

  @ApiPropertyOptional({
    example: 4200,
    description: 'Updated subtotal before tax.',
  })
  @IsOptional()
  @IsNumber()
  subtotal?: number;

  @ApiPropertyOptional({
    example: 8,
    description: 'Updated tax rate or tax percentage value.',
  })
  @IsOptional()
  @IsNumber()
  tax?: number;

  @ApiPropertyOptional({
    example: 89,
    description: 'Updated tax amount.',
  })
  @IsOptional()
  @IsNumber()
  taxAmount?: number;

  @ApiPropertyOptional({
    example: 150,
    description: 'Updated discount amount applied to the quote.',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  discount?: number;

  @ApiPropertyOptional({
    example: 75,
    description: 'Updated shipping fee applied to the quote.',
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  shippingFee?: number;

  @ApiPropertyOptional({
    example: 4289,
    description: 'Updated grand total including tax.',
  })
  @IsOptional()
  @IsNumber()
  total?: number;

  @ApiPropertyOptional({
    type: () => QuoteLineItemInput,
    isArray: true,
    example: [
      {
        serviceId: '8f1e52bc-5a3c-4f5b-8f80-51f0b4649224',
        quantity: 2,
      },
      {
        serviceId: '44b4eb0d-8431-4224-9b98-2f350f0be93a',
        quantity: 1,
      },
      {
        productName: 'Custom Trim Work',
        ourPrice: 350,
        quantity: 1,
      },
    ],
    description:
      'Replacement services for the quote line items. Their current productName and ourPrice are snapshotted into the quote together with the requested quantity. Provide productName (and optionally ourPrice) instead of serviceId to add a custom line item that is not in the service catalog.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => QuoteLineItemInput)
  lineItems?: QuoteLineItemInput[];

  @ApiPropertyOptional({
    type: () => QuotePaymentScheduleInput,
    description:
      'Replacement payment schedule for the quote. Required when changing the quote total for a quote that already has a schedule.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => QuotePaymentScheduleInput)
  paymentSchedule?: QuotePaymentScheduleInput;
}

export class RespondToQuoteInput {
  @ApiProperty({
    enum: QuoteStatus,
    enumName: 'QuoteStatus',
    example: QuoteStatus.IN_REVIEW,
    description:
      'Client decision for the quote. Only APPROVED, REJECTED, and IN_REVIEW are accepted here.',
  })
  @IsEnum(QuoteStatus)
  status: QuoteStatus;

  @ApiPropertyOptional({
    example: 'Please adjust the installation timeline before I approve this.',
    description:
      'Client feedback. Required when the quote is rejected or sent for review.',
  })
  @IsOptional()
  @IsString()
  comment?: string;
}

export class QuoteProjectSummaryResponse {
  @ApiProperty({
    example: '6f870b4d-60f4-4b6d-a75a-6fc6240ce788',
    description: 'Unique identifier for the related project.',
  })
  id: string;

  @ApiProperty({
    example: 'Solar Site Buildout',
    description: 'Display name for the related project.',
  })
  name: string;

  @ApiProperty({
    enum: ProjectStatus,
    enumName: 'ProjectStatus',
    example: ProjectStatus.QUOTED,
    description: 'Current status of the related project.',
  })
  status: ProjectStatus;

  @ApiProperty({
    example: '8f1e52bc-5a3c-4f5b-8f80-51f0b4649224',
    description: 'Client id that owns the project.',
  })
  clientId: string;
}

export class QuoteLineItemResponse {
  @ApiProperty({
    example: '3aa91264-c8dc-4fc7-8532-a65153a36429',
    description: 'Unique identifier for the quote line item row.',
  })
  id: string;

  @ApiProperty({
    example: 'Solar Panel Installation',
    description: 'Snapshot of the selected service product name.',
  })
  productName: string;

  @ApiPropertyOptional({
    example: '4200',
    description:
      'Snapshot of the selected service unit price as a decimal string.',
    nullable: true,
  })
  ourPrice: string | null;

  @ApiProperty({
    example: 2,
    description: 'Requested quantity for this line item.',
  })
  quantity: number;

  @ApiPropertyOptional({
    example: '8400',
    description:
      'Calculated line total as quantity multiplied by the snapshotted unit price.',
    nullable: true,
  })
  lineTotal: string | null;
}

export class QuoteInvoicePaymentResponse {
  @ApiProperty({
    example: '3aa91264-c8dc-4fc7-8532-a65153a36429',
    description: 'Unique identifier for the payment.',
  })
  id: string;

  @ApiProperty({
    example: '2026-05-25T09:30:00.000Z',
    description: 'Timestamp recorded for the payment.',
  })
  createdAt: string;

  @ApiProperty({
    enum: PaymentMethod,
    enumName: 'PaymentMethod',
    example: PaymentMethod.WIRE,
    description: 'Payment method used.',
  })
  method: PaymentMethod;

  @ApiProperty({
    example: 'WIRE-23456789',
    description: 'Reference stored against the payment.',
  })
  reference: string;

  @ApiProperty({
    example: '1500',
    description: 'Payment amount as a decimal string.',
  })
  amount: string;
}

export class QuoteInvoiceResponse {
  @ApiProperty({
    example: 'cb1efe79-56d6-43cf-9882-cb7739a32918',
    description: 'Unique identifier for the invoice.',
  })
  id: string;

  @ApiProperty({
    example: 'INV-20260527-001',
    description: 'Human-readable identifier for the invoice.',
  })
  invoiceId: string;

  @ApiProperty({
    enum: QuoteStatus,
    enumName: 'QuoteStatus',
    example: QuoteStatus.APPROVED,
    description: 'Current status stored on the invoice snapshot.',
  })
  status: QuoteStatus;

  @ApiProperty({
    example: '4289',
    description: 'Grand total as a decimal string.',
  })
  total: string;

  @ApiProperty({
    type: () => QuoteInvoicePaymentResponse,
    isArray: true,
    description: 'Payments recorded against this invoice.',
  })
  payments: QuoteInvoicePaymentResponse[];

  @ApiProperty({
    example: '2026-05-24T10:30:00.000Z',
    description: 'Timestamp when the invoice was created.',
  })
  createdAt: string;
}

export class QuotePaymentSchedulePaymentResponse {
  @ApiProperty({
    example: 'Payment 1',
    description: 'Display label for this scheduled payment.',
  })
  name: string;

  @ApiProperty({
    example: '800',
    description: 'Amount due for this payment as a decimal string.',
  })
  amount: string;

  @ApiProperty({
    example: '50',
    description: 'Percentage share stored for this payment.',
  })
  percentage: string;

  @ApiProperty({
    example: '2026-06-15T00:00:00.000Z',
    description:
      'Due date for this payment, or "Date of Invoice Generation" when applicable.',
  })
  date: string;
}

export class QuotePaymentScheduleDepositResponse {
  @ApiProperty({
    example: 'Deposit',
    description: 'Display label for the deposit row.',
  })
  name: string;

  @ApiProperty({
    example: 'percentage',
    description: 'How the deposit is defined: fixed or percentage.',
  })
  amountType: 'fixed' | 'percentage';

  @ApiProperty({
    example: '20',
    description: 'Deposit percentage of the quote total.',
  })
  percentage: string;

  @ApiProperty({
    example: '400',
    description: 'Deposit amount as a decimal string.',
  })
  amount: string;

  @ApiProperty({
    example: 'Date of Invoice Generation',
    description: 'Due date marker or exact due date for the deposit.',
  })
  date: string;
}

export class QuotePaymentScheduleBalanceResponse {
  @ApiPropertyOptional({
    example: 'Balance',
    description: 'Display label for the balance row when not split.',
    nullable: true,
  })
  name?: string | null;

  @ApiProperty({
    example: '1600',
    description: 'Balance amount as a decimal string.',
  })
  amount: string;

  @ApiProperty({
    example: '80',
    description: 'Balance percentage of the quote total.',
  })
  percentage: string;

  @ApiPropertyOptional({
    example: '2026-06-30T00:00:00.000Z',
    description:
      'Due date when the balance is not split, or null when the balance is split.',
    nullable: true,
  })
  date?: string | null;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the balance has been split into installments.',
    nullable: true,
  })
  split?: boolean;

  @ApiPropertyOptional({
    type: () => QuotePaymentSchedulePaymentResponse,
    isArray: true,
    description: 'Installments that make up the split balance.',
  })
  payments?: QuotePaymentSchedulePaymentResponse[];
}

export class QuotePaymentScheduleFullPaymentResponse {
  @ApiProperty({
    example: 'Full Payment',
    description: 'Display label for the full payment row.',
  })
  name: string;

  @ApiProperty({
    example: '2000',
    description: 'Full payment amount as a decimal string.',
  })
  amount: string;

  @ApiProperty({
    example: '100',
    description: 'Full payment percentage. This is always 100.',
  })
  percentage: string;

  @ApiProperty({
    example: '2026-06-30T00:00:00.000Z',
    description: 'Due date for the full payment.',
  })
  date: string;
}

export class QuotePaymentScheduleResponse {
  @ApiProperty({
    enum: QuotePaymentScheduleType,
    enumName: 'QuotePaymentScheduleType',
    example: QuotePaymentScheduleType.FULL_PAYMENT,
    description: 'Stored payment schedule mode.',
  })
  type: QuotePaymentScheduleType;

  @ApiProperty({
    example: '2000',
    description: 'Total amount covered by this schedule.',
  })
  totalAmount: string;

  @ApiPropertyOptional({
    type: () => QuotePaymentScheduleDepositResponse,
    description: 'Deposit details when the schedule includes a deposit.',
    nullable: true,
  })
  deposit?: QuotePaymentScheduleDepositResponse | null;

  @ApiPropertyOptional({
    type: () => QuotePaymentScheduleBalanceResponse,
    description: 'Balance details when the schedule includes a balance.',
    nullable: true,
  })
  balance?: QuotePaymentScheduleBalanceResponse | null;

  @ApiPropertyOptional({
    type: () => QuotePaymentScheduleFullPaymentResponse,
    description: 'Full payment details when the schedule is FULL_PAYMENT.',
    nullable: true,
  })
  fullPayment?: QuotePaymentScheduleFullPaymentResponse | null;
}

export class QuoteResponse {
  @ApiProperty({
    example: '8f1e52bc-5a3c-4f5b-8f80-51f0b4649224',
    description: 'Unique identifier for the quote.',
  })
  id: string;

  @ApiProperty({
    example: 'Solar Panel Installation',
    description: 'Display name for the quote.',
  })
  name: string;

  @ApiProperty({
    example: 'QT-2026-00001',
    description: 'Human-readable quote identifier.',
  })
  quoteId: string;

  @ApiProperty({
    enum: QuoteStatus,
    enumName: 'QuoteStatus',
    example: QuoteStatus.PENDING,
    description: 'Current status of the quote.',
  })
  status: QuoteStatus;

  @ApiPropertyOptional({
    example:
      'Doors to be solid core Masonite Carrara unless otherwise specified.',
    description: 'Staff-authored message stored on the quote.',
    nullable: true,
  })
  message: string | null;

  @ApiPropertyOptional({
    example: 'Please split the work into two phases.',
    description: 'Latest client feedback on the quote.',
    nullable: true,
  })
  clientComment: string | null;

  @ApiProperty({
    example: '2026-05-17T00:00:00.000Z',
    description: 'Issue date for the quote.',
  })
  dateIssued: string;

  @ApiProperty({
    example: '2026-05-31T00:00:00.000Z',
    description: 'Validity end date for the quote.',
  })
  validUntil: string;

  @ApiProperty({
    example: '4200',
    description: 'Subtotal before tax as a decimal string.',
  })
  subtotal: string;

  @ApiProperty({
    example: '8',
    description: 'Tax value as a decimal string.',
  })
  tax: string;

  @ApiProperty({
    example: '89',
    description: 'Tax amount as a decimal string.',
  })
  taxAmount: string;

  @ApiProperty({
    example: '150',
    description: 'Discount amount as a decimal string.',
  })
  discount: string;

  @ApiProperty({
    example: '75',
    description: 'Shipping fee as a decimal string.',
  })
  shippingFee: string;

  @ApiProperty({
    example: '4289',
    description: 'Grand total as a decimal string.',
  })
  total: string;

  @ApiProperty({
    type: () => QuoteProjectSummaryResponse,
    description: 'Project linked to this quote.',
  })
  project: QuoteProjectSummaryResponse;

  @ApiProperty({
    type: () => QuoteLineItemResponse,
    isArray: true,
    description: 'Snapshot line items stored directly on the quote.',
  })
  lineItems: QuoteLineItemResponse[];

  @ApiPropertyOptional({
    type: () => QuotePaymentScheduleResponse,
    description: 'Payment schedule stored against the quote.',
    nullable: true,
  })
  paymentSchedule: QuotePaymentScheduleResponse | null;

  @ApiProperty({
    type: () => QuoteInvoiceResponse,
    isArray: true,
    description:
      'Invoices generated from this quote together with their payments.',
  })
  invoices: QuoteInvoiceResponse[];

  @ApiProperty({
    example: '2026-05-24T10:30:00.000Z',
    description: 'Timestamp when the quote was created.',
  })
  createdAt: string;

  @ApiProperty({
    example: '2026-05-24T10:35:00.000Z',
    description: 'Timestamp when the quote was last updated.',
  })
  updatedAt: string;
}

export class CreateQuoteResponse {
  @ApiProperty({
    example: 'Quote created successfully',
    description: 'Confirmation message returned after creating a quote.',
  })
  message: string;

  @ApiProperty({
    type: () => QuoteResponse,
    description: 'The newly created quote.',
  })
  quote: QuoteResponse;
}

export class UpdateQuoteResponse {
  @ApiProperty({
    example: 'Quote updated successfully',
    description: 'Confirmation message returned after updating a quote.',
  })
  message: string;

  @ApiProperty({
    type: () => QuoteResponse,
    description: 'The updated quote.',
  })
  quote: QuoteResponse;
}

export class RespondToQuoteResponse {
  @ApiProperty({
    example: 'Quote response recorded successfully',
    description: 'Confirmation message returned after the client responds.',
  })
  message: string;

  @ApiProperty({
    type: () => QuoteResponse,
    description: 'The quote after the client response is applied.',
  })
  quote: QuoteResponse;
}
