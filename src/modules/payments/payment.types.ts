import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PaymentMethod,
  ProjectPaymentStatus,
} from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from 'class-validator';

export class CreatePaymentInput {
  @ApiProperty({
    example: '2026-05-25T09:30:00.000Z',
    description: 'Timestamp that should be stored as the payment creation time.',
  })
  @IsDateString()
  createdAt: string;

  @ApiProperty({
    example: '7ecb34de-c8dc-4fc7-8532-a65153a36429',
    description: 'Unique identifier for the invoice receiving the payment.',
  })
  @IsUUID()
  invoiceId: string;

  @ApiProperty({
    enum: PaymentMethod,
    enumName: 'PaymentMethod',
    example: PaymentMethod.ACH,
    description:
      'Payment channel used. Allowed values: ACH, WIRE, CREDIT_CARD, CHECK.',
  })
  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @ApiPropertyOptional({
    example: 'ACH-20260525093000000',
    description:
      'Optional payment reference. If omitted, the API generates one from the payment method prefix and createdAt timestamp. Provided values must start with ACH-, WIRE-, CC-, or CHK- depending on method.',
  })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiProperty({
    example: 1500,
    description: 'Amount collected for this payment.',
  })
  @IsNumber()
  @Min(0.01)
  amount: number;
}

export class PaymentResponse {
  @ApiProperty({
    example: '3aa91264-c8dc-4fc7-8532-a65153a36429',
    description: 'Unique identifier for the payment.',
  })
  id: string;

  @ApiProperty({
    example: '6f870b4d-60f4-4b6d-a75a-6fc6240ce788',
    description: 'Project id this payment belongs to.',
  })
  projectId: string;

  @ApiProperty({
    example: '7ecb34de-c8dc-4fc7-8532-a65153a36429',
    description: 'Invoice id this payment belongs to.',
  })
  invoiceId: string;

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

export class PaymentClientSummaryResponse {
  @ApiProperty({
    example: '8f1e52bc-5a3c-4f5b-8f80-51f0b4649224',
    description: 'Unique identifier for the client.',
  })
  id: string;

  @ApiProperty({
    example: 'Jane Client',
    description: 'Display name for the client.',
  })
  name: string;

  @ApiProperty({
    example: 'jane.client@example.com',
    description: 'Email address of the client.',
  })
  email: string;

  @ApiPropertyOptional({
    example: 'Jane Interiors',
    description: 'Company name of the client.',
    nullable: true,
  })
  company: string | null;
}

export class PaymentProjectSummaryResponse {
  @ApiProperty({
    example: '6f870b4d-60f4-4b6d-a75a-6fc6240ce788',
    description: 'Unique identifier for the related project.',
  })
  id: string;

  @ApiProperty({
    example: 'Kitchen Fit-Out',
    description: 'Display name for the related project.',
  })
  name: string;

  @ApiProperty({
    enum: ProjectPaymentStatus,
    enumName: 'ProjectPaymentStatus',
    example: ProjectPaymentStatus.PARTIALLY_PAID,
    description: 'Current payment status of the project.',
  })
  paymentStatus: ProjectPaymentStatus;

  @ApiProperty({
    type: () => PaymentClientSummaryResponse,
    description: 'Client that owns the project.',
  })
  client: PaymentClientSummaryResponse;
}

export class AdminPaymentResponse {
  @ApiProperty({
    example: '3aa91264-c8dc-4fc7-8532-a65153a36429',
    description: 'Unique identifier for the payment.',
  })
  id: string;

  @ApiProperty({
    example: '6f870b4d-60f4-4b6d-a75a-6fc6240ce788',
    description: 'Project id this payment belongs to.',
  })
  projectId: string;

  @ApiProperty({
    example: '7ecb34de-c8dc-4fc7-8532-a65153a36429',
    description: 'Invoice id this payment belongs to.',
  })
  invoiceId: string;

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

  @ApiProperty({
    type: () => PaymentProjectSummaryResponse,
    description: 'Project and client tied to the payment.',
  })
  project: PaymentProjectSummaryResponse;
}

export class ClientPaymentProjectResponse {
  @ApiProperty({
    example: '6f870b4d-60f4-4b6d-a75a-6fc6240ce788',
    description: 'Unique identifier for the related project.',
  })
  id: string;

  @ApiProperty({
    example: 'Kitchen Fit-Out',
    description: 'Display name for the related project.',
  })
  name: string;

  @ApiProperty({
    enum: ProjectPaymentStatus,
    enumName: 'ProjectPaymentStatus',
    example: ProjectPaymentStatus.PARTIALLY_PAID,
    description: 'Current payment status of the project.',
  })
  paymentStatus: ProjectPaymentStatus;
}

export class ClientPaymentResponse {
  @ApiProperty({
    example: '3aa91264-c8dc-4fc7-8532-a65153a36429',
    description: 'Unique identifier for the payment.',
  })
  id: string;

  @ApiProperty({
    example: '6f870b4d-60f4-4b6d-a75a-6fc6240ce788',
    description: 'Project id this payment belongs to.',
  })
  projectId: string;

  @ApiProperty({
    example: '7ecb34de-c8dc-4fc7-8532-a65153a36429',
    description: 'Invoice id this payment belongs to.',
  })
  invoiceId: string;

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

  @ApiProperty({
    type: () => ClientPaymentProjectResponse,
    description: 'Project tied to the payment.',
  })
  project: ClientPaymentProjectResponse;
}

export class CreatePaymentResponse {
  @ApiProperty({
    example: 'Payment recorded successfully',
    description: 'Confirmation message returned after storing a payment.',
  })
  message: string;

  @ApiProperty({
    type: () => PaymentResponse,
    description: 'The payment that was just recorded.',
  })
  payment: PaymentResponse;

  @ApiProperty({
    enum: ProjectPaymentStatus,
    enumName: 'ProjectPaymentStatus',
    example: ProjectPaymentStatus.PARTIALLY_PAID,
    description: 'Updated payment status for the related project.',
  })
  paymentStatus: ProjectPaymentStatus;

  @ApiProperty({
    example: '4500',
    description: 'Total amount paid so far across the project invoices.',
  })
  amountPaid: string;

  @ApiProperty({
    example: '2500',
    description: 'Remaining balance still due across the project invoices.',
  })
  amountDue: string;
}

export class ProjectPaymentsResponse {
  @ApiProperty({
    example: '6f870b4d-60f4-4b6d-a75a-6fc6240ce788',
    description: 'Project id that owns the returned payments.',
  })
  projectId: string;

  @ApiProperty({
    enum: ProjectPaymentStatus,
    enumName: 'ProjectPaymentStatus',
    example: ProjectPaymentStatus.PAID,
    description: 'Current payment status for the project.',
  })
  paymentStatus: ProjectPaymentStatus;

  @ApiProperty({
    example: '7000',
    description: 'Total amount paid so far across the project invoices.',
  })
  amountPaid: string;

  @ApiProperty({
    example: '0',
    description: 'Remaining balance still due across the project invoices.',
  })
  amountDue: string;

  @ApiProperty({
    type: () => PaymentResponse,
    isArray: true,
    description: 'Payments recorded against the project.',
  })
  payments: PaymentResponse[];
}

export class ClientPaymentsResponse {
  @ApiProperty({
    type: () => PaymentClientSummaryResponse,
    description: 'Client whose payments were returned.',
  })
  client: PaymentClientSummaryResponse;

  @ApiProperty({
    example: '7000',
    description: 'Total amount paid across all projects for the client.',
  })
  amountPaid: string;

  @ApiProperty({
    type: () => ClientPaymentResponse,
    isArray: true,
    description: 'Payments recorded across the client’s projects.',
  })
  payments: ClientPaymentResponse[];
}
