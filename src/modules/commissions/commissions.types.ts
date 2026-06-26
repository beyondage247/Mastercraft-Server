import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CommissionStatus } from '@prisma/client';
import { IsEnum, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class UpdateCommissionInput {
  @ApiPropertyOptional({
    example: 7.5,
    description: 'Commission percentage. Must be between 0 and 100.',
    nullable: true,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  percentageCommission?: number;

  @ApiPropertyOptional({
    example: 150,
    description:
      'Amount paid to staff for this commission. Must be >= 0.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  commissionAmountPaid?: number;

  @ApiPropertyOptional({
    enum: CommissionStatus,
    enumName: 'CommissionStatus',
    example: CommissionStatus.PAID,
    description:
      'Manual status update for the commission. Only PAID can be set through this endpoint.',
    nullable: true,
  })
  @IsOptional()
  @IsEnum(CommissionStatus)
  status?: CommissionStatus;
}

export class CommissionStaffResponse {
  @ApiProperty({
    example: '44b4eb0d-8431-4224-9b98-2f350f0be93a',
    description:
      'Unique identifier for the staff user who owns the commission.',
  })
  id: string;

  @ApiProperty({
    example: 'Pat Partner',
    description: 'Full name of the staff user who owns the commission.',
  })
  name: string;

  @ApiProperty({
    example: 'partner@example.com',
    description: 'Email address of the staff user who owns the commission.',
  })
  email: string;
}

export class CommissionClientResponse {
  @ApiProperty({
    example: '8f1e52bc-5a3c-4f5b-8f80-51f0b4649224',
    description: 'Unique identifier for the client related to the commission.',
  })
  id: string;

  @ApiProperty({
    example: 'Chris Rutlage',
    description: 'Client name.',
  })
  name: string;

  @ApiProperty({
    example: 'chris@example.com',
    description: 'Client email address.',
  })
  email: string;

  @ApiPropertyOptional({
    example: 'Rutlage Energy',
    description: 'Client company name when available.',
    nullable: true,
  })
  company: string | null;
}

export class CommissionProjectResponse {
  @ApiProperty({
    example: '6f870b4d-60f4-4b6d-a75a-6fc6240ce788',
    description: 'Unique identifier for the related project.',
  })
  id: string;

  @ApiProperty({
    example: 'Solar Site Buildout',
    description: 'Project name.',
  })
  name: string;
}

export class CommissionQuoteResponse {
  @ApiProperty({
    example: 'cb1efe79-56d6-43cf-9882-cb7739a32918',
    description: 'Unique identifier for the related quote.',
  })
  id: string;

  @ApiProperty({
    example: 'QOT-20260525-001',
    description: 'Human-readable quote identifier.',
  })
  quoteId: string;

  @ApiProperty({
    example: 'Solar Panel Installation',
    description: 'Quote name.',
  })
  name: string;

  @ApiProperty({
    example: '4289',
    description: 'Quote total as a decimal string.',
  })
  total: string;

  @ApiProperty({
    example: '89',
    description: 'Quote tax amount as a decimal string.',
  })
  taxAmount: string;

  @ApiProperty({
    type: () => CommissionProjectResponse,
    description: 'Project associated with the quote.',
  })
  project: CommissionProjectResponse;
}

export class CommissionResponse {
  @ApiProperty({
    example: 'd8dff8fb-1f70-4b84-aa17-6f7d5f123456',
    description: 'Unique identifier for the commission.',
  })
  id: string;

  @ApiProperty({
    example: '4200',
    description:
      'Commission base total as a decimal string. This is quote total minus quote tax amount.',
  })
  total: string;

  @ApiProperty({
    example: '7.5',
    description: 'Commission percentage as a decimal string.',
  })
  percentageCommission: string;

  @ApiProperty({
    example: '315',
    description: 'Computed commission amount as a decimal string.',
  })
  amount: string;

  @ApiPropertyOptional({
    example: '7ecb34de-c8dc-4fc7-8532-a65153a36429',
    description:
      'Invoice ID linked through the quote. Null if no invoice has been generated yet.',
    nullable: true,
  })
  invoiceId: string | null;

  @ApiProperty({
    example: '1500',
    description:
      'Total amount paid by the client on the invoice as a decimal string.',
  })
  amountPaid: string;

  @ApiProperty({
    example: '150',
    description:
      'Amount paid to staff for this commission as a decimal string.',
  })
  commissionAmountPaid: string;

  @ApiProperty({
    example: '165',
    description:
      'Remaining commission balance (amount - commissionAmountPaid) as a decimal string.',
  })
  commissionAmountBalance: string;

  @ApiProperty({
    enum: CommissionStatus,
    enumName: 'CommissionStatus',
    example: CommissionStatus.QUOTED_COMMISSION,
    description: 'Current commission lifecycle status.',
  })
  status: CommissionStatus;

  @ApiPropertyOptional({
    example: '2026-06-06T14:20:00.000Z',
    description: 'Timestamp when the commission was marked as paid.',
    nullable: true,
  })
  paidAt: string | null;

  @ApiProperty({
    example: '2026-06-06T12:00:00.000Z',
    description: 'Timestamp when the commission was created.',
  })
  createdAt: string;

  @ApiProperty({
    example: '2026-06-06T12:15:00.000Z',
    description: 'Timestamp when the commission was last updated.',
  })
  updatedAt: string;

  @ApiProperty({
    type: () => CommissionStaffResponse,
    description: 'Staff user who owns the commission.',
  })
  staff: CommissionStaffResponse;

  @ApiProperty({
    type: () => CommissionClientResponse,
    description: 'Client associated with the commission.',
  })
  client: CommissionClientResponse;

  @ApiProperty({
    type: () => CommissionQuoteResponse,
    description: 'Quote associated with the commission.',
  })
  quote: CommissionQuoteResponse;
}

export class UpdateCommissionResponse {
  @ApiProperty({
    example: 'Commission updated successfully',
    description: 'Confirmation message returned after updating the commission.',
  })
  message: string;

  @ApiProperty({
    type: () => CommissionResponse,
    description: 'The updated commission.',
  })
  commission: CommissionResponse;
}
