import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AvailabilityStatus } from '@prisma/client';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export class UpdateCatalogItemInput {
  @ApiPropertyOptional({
    example:
      `1 3/8" Door - Raised Panel - SL-37, SL-22, SL-33-SP, SL-50N, SL-33 (1'0 up to 1'5)`,
    description: 'Display name for the catalog item.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  productName?: string | null;

  @ApiPropertyOptional({
    example: 'KD-111',
    description: 'Supplier or internal item code.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  itemCode?: string | null;

  @ApiPropertyOptional({
    example: 'Raised Panel',
    description: 'Subcategory label for the catalog item.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  subcategory?: string | null;

  @ApiPropertyOptional({
    example: '219',
    description: 'Supplier cost stored as a decimal string.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  supplierCost?: string | null;

  @ApiPropertyOptional({
    example: '306.6',
    description: 'Customer price stored as a decimal string.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  ourPrice?: string | null;

  @ApiPropertyOptional({
    example: '40',
    description: 'Markup percentage stored as a decimal string.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  markUp?: string | null;

  @ApiPropertyOptional({
    enum: AvailabilityStatus,
    enumName: 'AvailabilityStatus',
    isArray: true,
    example: [AvailabilityStatus.EMAIL_FOR_QUOTE, AvailabilityStatus.IN_STOCK],
    description: 'Normalized availability values for the catalog item.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(AvailabilityStatus, { each: true })
  availabilityStatus?: AvailabilityStatus[] | null;

  @ApiPropertyOptional({
    example: 'Interior Doors',
    description: 'Top-level category for the catalog item.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  category?: string | null;

  @ApiPropertyOptional({
    example: 'Koch Doors',
    description: 'Supplier name for the catalog item.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  supplier?: string | null;

  @ApiPropertyOptional({
    example: `1'0 up to 1'5`,
    description: 'Size or dimension descriptor.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  sizeDimension?: string | null;

  @ApiPropertyOptional({
    example: 'Each',
    description: 'Unit of measure.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  unitMeasure?: string | null;

  @ApiPropertyOptional({
    example: '8728 - V-GROOVE',
    description: 'Style or profile descriptor.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  styleProfile?: string | null;

  @ApiPropertyOptional({
    example: '111',
    description: 'Supplier catalogue reference.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  supplierCatalogue?: string | null;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the catalog item is active.',
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean | null;

  @ApiPropertyOptional({
    example: '2026-05-24T00:00:00.000Z',
    description: 'Timestamp for the most recent price update.',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  lastPriceUpdate?: string | null;
}

export class CatalogItemResponse {
  @ApiProperty({
    example: '8f1e52bc-5a3c-4f5b-8f80-51f0b4649224',
    description: 'Unique identifier for the catalog item.',
  })
  id: string;

  @ApiProperty({
    example:
      `1 3/8" Door - Raised Panel - SL-37, SL-22, SL-33-SP, SL-50N, SL-33 (1'0 up to 1'5)`,
    description: 'Display name for the catalog item.',
  })
  productName: string;

  @ApiPropertyOptional({
    example: 'KD-111',
    description: 'Supplier or internal item code.',
    nullable: true,
  })
  itemCode: string | null;

  @ApiPropertyOptional({
    example: 'Raised Panel',
    description: 'Subcategory label for the catalog item.',
    nullable: true,
  })
  subcategory: string | null;

  @ApiPropertyOptional({
    example: '219',
    description: 'Supplier cost as a decimal string.',
    nullable: true,
  })
  supplierCost: string | null;

  @ApiPropertyOptional({
    example: '306.6',
    description: 'Customer price as a decimal string.',
    nullable: true,
  })
  ourPrice: string | null;

  @ApiPropertyOptional({
    example: '40',
    description: 'Markup percentage as a decimal string.',
    nullable: true,
  })
  markUp: string | null;

  @ApiProperty({
    enum: AvailabilityStatus,
    enumName: 'AvailabilityStatus',
    isArray: true,
    example: [AvailabilityStatus.EMAIL_FOR_QUOTE, AvailabilityStatus.IN_STOCK],
    description: 'Normalized availability values for the catalog item.',
  })
  availabilityStatus: AvailabilityStatus[];

  @ApiProperty({
    example: 'Interior Doors',
    description: 'Top-level category for the catalog item.',
  })
  category: string;

  @ApiProperty({
    example: 'Koch Doors',
    description: 'Supplier name for the catalog item.',
  })
  supplier: string;

  @ApiPropertyOptional({
    example: `1'0 up to 1'5`,
    description: 'Size or dimension descriptor.',
    nullable: true,
  })
  sizeDimension: string | null;

  @ApiPropertyOptional({
    example: 'Each',
    description: 'Unit of measure.',
    nullable: true,
  })
  unitMeasure: string | null;

  @ApiPropertyOptional({
    example: '8728 - V-GROOVE',
    description: 'Style or profile descriptor.',
    nullable: true,
  })
  styleProfile: string | null;

  @ApiPropertyOptional({
    example: '111',
    description: 'Supplier catalogue reference.',
    nullable: true,
  })
  supplierCatalogue: string | null;

  @ApiProperty({
    example: true,
    description: 'Whether the catalog item is active.',
  })
  active: boolean;

  @ApiPropertyOptional({
    example: '2026-05-24T00:00:00.000Z',
    description: 'Timestamp for the most recent price update.',
    nullable: true,
  })
  lastPriceUpdate: string | null;

  @ApiProperty({
    example: '2026-05-24T10:30:00.000Z',
    description: 'Timestamp when the catalog item was created.',
  })
  createdAt: string;

  @ApiProperty({
    example: '2026-05-24T10:35:00.000Z',
    description: 'Timestamp when the catalog item was last updated.',
  })
  updatedAt: string;
}

export class UpdateCatalogItemResponse {
  @ApiProperty({
    example: 'Catalog item updated successfully',
    description: 'Confirmation message returned after updating the catalog item.',
  })
  message: string;

  @ApiProperty({
    type: () => CatalogItemResponse,
    description: 'The updated catalog item.',
  })
  item: CatalogItemResponse;
}

export class CatalogImportIssueResponse {
  @ApiProperty({
    example: 3,
    description: 'Worksheet row number where the issue occurred.',
  })
  row: number;

  @ApiProperty({
    example: 'productName is required',
    description: 'Description of the import issue.',
  })
  reason: string;
}

export class ImportCatalogItemsResponse {
  @ApiProperty({
    example: 'Catalog import completed',
    description: 'Summary message returned after processing the workbook.',
  })
  message: string;

  @ApiProperty({
    example: 12,
    description: 'Total number of worksheet rows processed.',
  })
  processedCount: number;

  @ApiProperty({
    example: 8,
    description: 'Number of new catalog items inserted.',
  })
  importedCount: number;

  @ApiProperty({
    example: 2,
    description: 'Number of rows skipped because they were blank or duplicates.',
  })
  skippedCount: number;

  @ApiProperty({
    example: 2,
    description: 'Number of rows rejected because validation failed.',
  })
  errorCount: number;

  @ApiProperty({
    type: () => CatalogImportIssueResponse,
    isArray: true,
    description: 'Validation errors encountered while importing rows.',
  })
  errors: CatalogImportIssueResponse[];

  @ApiProperty({
    type: () => CatalogImportIssueResponse,
    isArray: true,
    description: 'Rows skipped because they were blank or duplicated an existing item.',
  })
  skippedRows: CatalogImportIssueResponse[];
}

export class ImportCatalogItemsBody {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Excel workbook containing catalog rows.',
  })
  file: unknown;
}
