import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ClientCredit,
  PaymentMethod,
  ProjectStageType,
  ProjectPaymentStatus,
  ProjectStatus,
  QuoteStatus,
  Role,
} from '@prisma/client';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const projectStatusDescription =
  'Current project status. Allowed values: PENDING, QUOTED, LOST, IN_PRODUCTION, COMPLETED.';

export class CreateProjectStageInput {
  @ApiProperty({
    example: 24,
    description: 'Budgeted hours allocated to the stage.',
  })
  @IsInt()
  @Min(0)
  hoursBudgeted: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Hours already spent on the stage.',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  hoursSpent?: number;

  @ApiPropertyOptional({
    example: 0,
    description: 'Completion percentage for the stage.',
    default: 0,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @ApiProperty({
    example: '2026-05-23T00:00:00.000Z',
    description: 'Planned start date for the stage.',
  })
  @IsDateString()
  startDate: string;
}

export class CreateProjectInput {
  @ApiProperty({
    example: '8f1e52bc-5a3c-4f5b-8f80-51f0b4649224',
    description: 'Unique identifier for the client that owns the project.',
  })
  @IsUUID()
  clientId: string;

  @ApiProperty({
    example: 'Kitchen Fit-Out',
    description: 'Display name for the project.',
  })
  @IsString()
  name: string;

  @ApiProperty({
    example: 'Custom kitchen cabinetry and finishing works.',
    description: 'Detailed description of the project.',
  })
  @IsString()
  description: string;

  @ApiProperty({
    example: 'Lekki, Lagos',
    description: 'Project location.',
  })
  @IsString()
  location: string;

  @ApiProperty({
    example: 12,
    description: 'Fabrication effort or quantity tracked for the project.',
  })
  @IsInt()
  @Min(0)
  fabrication: number;

  @ApiProperty({
    example: '2026-05-23T00:00:00.000Z',
    description: 'Overall project start date.',
  })
  @IsDateString()
  startDate: string;

  @ApiProperty({
    example: '2026-06-30T00:00:00.000Z',
    description: 'Overall project end date.',
  })
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional({
    type: () => CreateProjectStageInput,
    description:
      'Optional configuration for the MIL stage. Defaults to zeroed values using the project start date when omitted.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateProjectStageInput)
  mil?: CreateProjectStageInput;

  @ApiPropertyOptional({
    type: () => CreateProjectStageInput,
    description:
      'Optional configuration for the Build/Assemble stage. Defaults to zeroed values using the project start date when omitted.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateProjectStageInput)
  buildAssemble?: CreateProjectStageInput;

  @ApiPropertyOptional({
    type: () => CreateProjectStageInput,
    description:
      'Optional configuration for the Finishing stage. Defaults to zeroed values using the project start date when omitted.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateProjectStageInput)
  finishing?: CreateProjectStageInput;

  @ApiPropertyOptional({
    type: () => CreateProjectStageInput,
    description:
      'Optional configuration for the Delivery stage. Defaults to zeroed values using the project start date when omitted.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateProjectStageInput)
  delivery?: CreateProjectStageInput;

  @ApiPropertyOptional({
    type: () => CreateProjectStageInput,
    description:
      'Optional configuration for the Install stage. Defaults to zeroed values using the project start date when omitted.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CreateProjectStageInput)
  install?: CreateProjectStageInput;
}

export class UpdateProjectStageInput {
  @ApiPropertyOptional({
    example: 32,
    description: 'Updated budgeted hours allocated to the stage.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  hoursBudgeted?: number;

  @ApiPropertyOptional({
    example: 10,
    description: 'Updated hours already spent on the stage.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  hoursSpent?: number;

  @ApiPropertyOptional({
    example: 45,
    description: 'Updated completion percentage for the stage.',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100)
  progress?: number;

  @ApiPropertyOptional({
    example: '2026-05-28T00:00:00.000Z',
    description: 'Updated start date for the stage.',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;
}

export class UpdateProjectStatusInput {
  @ApiPropertyOptional({
    enum: ProjectStatus,
    enumName: 'ProjectStatus',
    example: ProjectStatus.COMPLETED,
    description:
      'Only COMPLETED is allowed here, and only after the quote workflow has moved the project to IN_PRODUCTION.',
  })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({
    type: () => UpdateProjectStageInput,
    description: 'Use this object to update the MIL stage.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateProjectStageInput)
  mil?: UpdateProjectStageInput;

  @ApiPropertyOptional({
    type: () => UpdateProjectStageInput,
    description: 'Use this object to update the Build/Assemble stage.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateProjectStageInput)
  buildAssemble?: UpdateProjectStageInput;

  @ApiPropertyOptional({
    type: () => UpdateProjectStageInput,
    description: 'Use this object to update the Finishing stage.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateProjectStageInput)
  finishing?: UpdateProjectStageInput;

  @ApiPropertyOptional({
    type: () => UpdateProjectStageInput,
    description: 'Use this object to update the Delivery stage.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateProjectStageInput)
  delivery?: UpdateProjectStageInput;

  @ApiPropertyOptional({
    type: () => UpdateProjectStageInput,
    description: 'Use this object to update the Install stage.',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => UpdateProjectStageInput)
  install?: UpdateProjectStageInput;
}

export class ProjectAttachmentInput {
  @ApiProperty({
    type: [String],
    example: [
      '6f870b4d-60f4-4b6d-a75a-6fc6240ce788',
      '8f1e52bc-5a3c-4f5b-8f80-51f0b4649224',
    ],
    description: 'Upload ids to associate with the project attachment.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID(undefined, { each: true })
  uploadIds: string[];
}

export class UpdateProjectAttachmentInput {
  @ApiProperty({
    type: () => ProjectAttachmentInput,
    description: 'Attachment payload for the project.',
  })
  @ValidateNested()
  @Type(() => ProjectAttachmentInput)
  attachment: ProjectAttachmentInput;
}

export class CreateProjectCommentInput {
  @ApiProperty({
    example: '6f870b4d-60f4-4b6d-a75a-6fc6240ce788',
    description: 'Unique identifier for the project receiving the comment.',
  })
  @IsUUID()
  projectId: string;

  @ApiProperty({
    example: 'Please confirm the cabinet finish before production starts.',
    description: 'Comment text to add to the project.',
  })
  @IsString()
  message: string;
}

export class ProjectStageResponse {
  @ApiProperty({
    example: '3aa91264-c8dc-4fc7-8532-a65153a36429',
    description: 'Unique identifier for the project stage record.',
  })
  id: string;

  @ApiProperty({
    enum: ProjectStageType,
    enumName: 'ProjectStageType',
    example: ProjectStageType.MIL,
    description: 'Stage represented by this row.',
  })
  stage: ProjectStageType;

  @ApiProperty({
    example: 24,
    description: 'Budgeted hours allocated to the stage.',
  })
  hoursBudgeted: number;

  @ApiProperty({
    example: 4,
    description: 'Hours already spent on the stage.',
  })
  hoursSpent: number;

  @ApiProperty({
    example: 20,
    description: 'Completion percentage for the stage.',
  })
  progress: number;

  @ApiProperty({
    example: '2026-05-23T00:00:00.000Z',
    description: 'Planned start date for the stage.',
  })
  startDate: Date;
}

export class ProjectClientResponse {
  @ApiProperty({
    example: '8f1e52bc-5a3c-4f5b-8f80-51f0b4649224',
    description: 'Unique identifier for the client.',
  })
  id: string;

  @ApiProperty({
    example: 'Jane Client',
    description: 'Full name of the client.',
  })
  name: string;

  @ApiProperty({
    example: 'jane.client@example.com',
    description: 'Email address of the client.',
  })
  email: string;

  @ApiProperty({
    example: '123456789',
    description: 'Phone number of the client.',
    nullable: true,
  })
  phone: string | null;

  @ApiProperty({
    example: 'Jane Inc.',
    description: 'Company name of the client.',
    nullable: true,
  })
  company: string | null;

  @ApiProperty({
    example: 'John Manager',
    description: 'Additional contact name for the client.',
    nullable: true,
  })
  additionalContact: string | null;

  @ApiProperty({
    example: 'accounts@janeinc.com',
    description: 'Additional email address for the client.',
    nullable: true,
  })
  additionalEmail: string | null;

  @ApiProperty({
    enum: ClientCredit,
    enumName: 'ClientCredit',
    example: ClientCredit.CREDIT_ACCOUNT,
    description: 'Credit type assigned to the client.',
    nullable: true,
  })
  clientCredit: ClientCredit | null;

  @ApiProperty({
    example: '44b4eb0d-8431-4224-9b98-2f350f0be93a',
    description: 'Assigned account partner id for the client.',
    nullable: true,
  })
  accountPartnerId: string | null;

  @ApiPropertyOptional({
    type: () => ProjectAccountPartnerResponse,
    description: 'Assigned account partner details for the client.',
    nullable: true,
  })
  accountPartner?: ProjectAccountPartnerResponse | null;
}

export class ProjectAccountPartnerResponse {
  @ApiProperty({
    example: '44b4eb0d-8431-4224-9b98-2f350f0be93a',
    description: 'Unique identifier for the assigned account partner.',
  })
  id: string;

  @ApiProperty({
    example: 'John Manager',
    description: 'Full name of the assigned account partner.',
  })
  name: string;

  @ApiProperty({
    example: 'john.manager@example.com',
    description: 'Email address of the assigned account partner.',
  })
  email: string;
}

export class ProjectQuoteSummaryResponse {
  @ApiProperty({
    example: 'cb1efe79-56d6-43cf-9882-cb7739a32918',
    description: 'Unique identifier for the related quote.',
  })
  id: string;

  @ApiProperty({
    example: 'QT-2026-00001',
    description: 'Human-readable identifier for the quote.',
  })
  quoteId: string;

  @ApiProperty({
    enum: QuoteStatus,
    enumName: 'QuoteStatus',
    example: QuoteStatus.PENDING,
    description: 'Current status of the related quote.',
  })
  status: QuoteStatus;

  @ApiProperty({
    example: '2026-05-31T00:00:00.000Z',
    description: 'Date the quote remains valid until.',
  })
  validUntil: Date;

  @ApiProperty({
    type: () => ProjectQuoteInvoiceSummaryResponse,
    isArray: true,
    description: 'Invoices that were generated from this quote.',
  })
  invoices: ProjectQuoteInvoiceSummaryResponse[];
}

export class ProjectQuoteInvoiceSummaryResponse {
  @ApiProperty({
    example: 'cb1efe79-56d6-43cf-9882-cb7739a32918',
    description: 'Unique identifier for the related invoice.',
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
    example: '2026-05-24T10:30:00.000Z',
    description: 'Timestamp when the invoice was created.',
  })
  createdAt: Date;
}

export class ProjectInvoiceLineItemResponse {
  @ApiProperty({
    example: '3aa91264-c8dc-4fc7-8532-a65153a36429',
    description: 'Unique identifier for the invoice line item row.',
  })
  id: string;

  @ApiProperty({
    example: 'Solar Panel Installation',
    description: 'Snapshot of the invoiced service product name.',
  })
  productName: string;

  @ApiPropertyOptional({
    example: '4200',
    description: 'Snapshot of the invoiced unit price as a decimal string.',
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

export class ProjectInvoiceResponse {
  @ApiProperty({
    example: 'cb1efe79-56d6-43cf-9882-cb7739a32918',
    description: 'Unique identifier for the related invoice.',
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

  @ApiPropertyOptional({
    example: 'Please confirm the cabinet finish before production starts.',
    description: 'Client comment copied into the invoice snapshot.',
    nullable: true,
  })
  clientComment: string | null;

  @ApiProperty({
    example: '2026-05-17T00:00:00.000Z',
    description: 'Issue date for the invoice.',
  })
  dateIssued: Date;

  @ApiProperty({
    example: '2026-05-31T00:00:00.000Z',
    description: 'Validity end date for the invoice.',
  })
  validUntil: Date;

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
    type: () => ProjectInvoiceLineItemResponse,
    isArray: true,
    description: 'Snapshot line items stored directly on the invoice.',
  })
  lineItems: ProjectInvoiceLineItemResponse[];

  @ApiProperty({
    example: '2026-05-24T10:30:00.000Z',
    description: 'Timestamp when the invoice was created.',
  })
  createdAt: Date;

  @ApiProperty({
    example: '2026-05-24T10:35:00.000Z',
    description: 'Timestamp when the invoice was last updated.',
  })
  updatedAt: Date;
}

export class ProjectPaymentResponse {
  @ApiProperty({
    example: '3aa91264-c8dc-4fc7-8532-a65153a36429',
    description: 'Unique identifier for the payment row.',
  })
  id: string;

  @ApiProperty({
    example: '7ecb34de-c8dc-4fc7-8532-a65153a36429',
    description: 'Invoice id this payment is attached to.',
  })
  invoiceId: string;

  @ApiProperty({
    example: '2026-05-25T09:30:00.000Z',
    description: 'Timestamp when the payment was recorded.',
  })
  createdAt: Date;

  @ApiProperty({
    enum: PaymentMethod,
    enumName: 'PaymentMethod',
    example: PaymentMethod.ACH,
    description: 'Payment channel used for the transaction.',
  })
  method: PaymentMethod;

  @ApiProperty({
    example: 'ACH-20260525093000000',
    description: 'Reference stored for the payment.',
  })
  reference: string;

  @ApiProperty({
    example: '1500',
    description: 'Payment amount as a decimal string.',
  })
  amount: string;
}

export class ProjectUploadResponse {
  @ApiProperty({
    example: '6f870b4d-60f4-4b6d-a75a-6fc6240ce788',
    description: 'Unique identifier for the upload.',
  })
  id: string;

  @ApiProperty({
    example: 'floor-plan.pdf',
    description: 'Original file name of the upload.',
  })
  name: string;

  @ApiProperty({
    example: 245760,
    description: 'File size in bytes.',
  })
  size: number;
}

export class ProjectAttachmentResponse {
  @ApiProperty({
    type: () => ProjectUploadResponse,
    isArray: true,
    description: 'Uploads attached to the project.',
  })
  uploads: ProjectUploadResponse[];
}

export class ProjectCommentUserResponse {
  @ApiProperty({
    example: '44b4eb0d-8431-4224-9b98-2f350f0be93a',
    description: 'Unique identifier for the user who wrote the comment.',
  })
  id: string;

  @ApiProperty({
    example: 'John Manager',
    description: 'Full name of the user who wrote the comment.',
  })
  name: string;

  @ApiProperty({
    enum: Role,
    enumName: 'Role',
    example: Role.STAFF,
    description: 'Role of the user who wrote the comment.',
  })
  role: Role;
}

export class ProjectCommentResponse {
  @ApiProperty({
    example: '3aa91264-c8dc-4fc7-8532-a65153a36429',
    description: 'Unique identifier for the project comment.',
  })
  id: string;

  @ApiProperty({
    example: 'Please confirm the cabinet finish before production starts.',
    description: 'Comment text stored for the project.',
  })
  message: string;

  @ApiProperty({
    example: '2026-05-27T12:00:00.000Z',
    description: 'Timestamp when the comment was created.',
  })
  createdAt: Date;

  @ApiProperty({
    type: () => ProjectCommentUserResponse,
    description: 'User who wrote the comment.',
  })
  user: ProjectCommentUserResponse;
}

export class ProjectResponse {
  @ApiProperty({
    example: '6f870b4d-60f4-4b6d-a75a-6fc6240ce788',
    description: 'Unique identifier for the project.',
  })
  id: string;

  @ApiProperty({
    example: '8f1e52bc-5a3c-4f5b-8f80-51f0b4649224',
    description: 'Unique identifier for the client that owns the project.',
  })
  clientId: string;

  @ApiProperty({
    example: 'Kitchen Fit-Out',
    description: 'Display name for the project.',
  })
  name: string;

  @ApiProperty({
    example: 'Custom kitchen cabinetry and finishing works.',
    description: 'Detailed description of the project.',
  })
  description: string;

  @ApiProperty({
    example: 'Lekki, Lagos',
    description: 'Project location.',
  })
  location: string;

  @ApiProperty({
    example: 12,
    description: 'Fabrication effort or quantity tracked for the project.',
  })
  fabrication: number;

  @ApiProperty({
    enum: ProjectStatus,
    enumName: 'ProjectStatus',
    example: ProjectStatus.PENDING,
    description: projectStatusDescription,
  })
  status: ProjectStatus;

  @ApiProperty({
    enum: ProjectPaymentStatus,
    enumName: 'ProjectPaymentStatus',
    example: ProjectPaymentStatus.UNPAID,
    description:
      'Payment progress for the project. Becomes PARTIALLY_PAID or PAID based on recorded payments versus the total of project invoices.',
  })
  paymentStatus: ProjectPaymentStatus;

  @ApiProperty({
    example: '2026-05-23T00:00:00.000Z',
    description: 'Overall project start date.',
  })
  startDate: Date;

  @ApiProperty({
    example: '2026-06-30T00:00:00.000Z',
    description: 'Overall project end date.',
  })
  endDate: Date;

  @ApiProperty({
    example: '2026-05-23T12:45:00.000Z',
    description: 'Timestamp when the project was created.',
  })
  createdAt: Date;

  @ApiProperty({
    type: () => ProjectStageResponse,
    isArray: true,
    description: 'Stages created for the project.',
  })
  stages: ProjectStageResponse[];

  @ApiProperty({
    type: () => ProjectClientResponse,
    description: 'Client details for the project owner.',
  })
  client: ProjectClientResponse;

  @ApiProperty({
    type: () => ProjectQuoteSummaryResponse,
    isArray: true,
    description: 'Quotes linked to the project, each with its invoices.',
  })
  quotes: ProjectQuoteSummaryResponse[];

  @ApiProperty({
    type: () => ProjectPaymentResponse,
    isArray: true,
    description: 'Payments recorded against the project.',
  })
  payments: ProjectPaymentResponse[];

  @ApiPropertyOptional({
    type: () => ProjectAttachmentResponse,
    description: 'Attachment currently linked to the project.',
    nullable: true,
  })
  attachment?: ProjectAttachmentResponse | null;

  @ApiProperty({
    type: () => ProjectCommentResponse,
    isArray: true,
    description: 'Comments recorded against the project.',
  })
  comments: ProjectCommentResponse[];
}

export class CreateProjectResponse {
  @ApiProperty({
    example: 'Project created successfully',
    description: 'Confirmation message returned after creating the project.',
  })
  message: string;

  @ApiProperty({
    type: () => ProjectResponse,
    description: 'The newly created project and its stages.',
  })
  project: ProjectResponse;
}

export class UpdateProjectResponse {
  @ApiProperty({
    example: 'Project updated successfully',
    description: 'Confirmation message returned after updating the project.',
  })
  message: string;

  @ApiProperty({
    type: () => ProjectResponse,
    description: 'The updated project and its stage records.',
  })
  project: ProjectResponse;
}

export class UpdateProjectAttachmentResponse {
  @ApiProperty({
    example: 'Project attachment updated successfully',
    description:
      'Confirmation message returned after updating the project attachment.',
  })
  message: string;

  @ApiProperty({
    type: () => ProjectResponse,
    description: 'The updated project including its attachment uploads.',
  })
  project: ProjectResponse;
}

export class CreateProjectCommentResponse {
  @ApiProperty({
    example: 'Project comment added successfully',
    description: 'Confirmation message returned after adding a comment.',
  })
  message: string;

  @ApiProperty({
    type: () => ProjectCommentResponse,
    description: 'The newly created project comment.',
  })
  comment: ProjectCommentResponse;
}
