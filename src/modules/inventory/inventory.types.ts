import { AvailabilityStatus } from '@prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsNumberString,
  Matches,
} from 'class-validator';

export class InventoryListQuery {
  @ApiPropertyOptional({
    example: 'plywood',
    description:
      'Search term matched against name, SKU, category, supplier, subcategory, and material.',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    example: 'Plywood',
    description: 'Exact category filter.',
  })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional({
    example: 'Mastercraft',
    description: 'Exact supplier filter.',
  })
  @IsOptional()
  @IsString()
  supplier?: string;

  @ApiPropertyOptional({
    enum: AvailabilityStatus,
    enumName: 'AvailabilityStatus',
    example: AvailabilityStatus.IN_STOCK,
    description: 'Availability filter.',
  })
  @IsOptional()
  @IsEnum(AvailabilityStatus)
  availabilityStatus?: AvailabilityStatus;

  @ApiPropertyOptional({
    example: 'true',
    description: 'Set to true or false to filter active items.',
  })
  @IsOptional()
  @Matches(/^(true|false)$/i, {
    message: 'active must be true or false',
  })
  active?: string;

  @ApiPropertyOptional({
    example: 'true',
    description:
      'Set to true to only return items where inStock is less than or equal to minReserve.',
  })
  @IsOptional()
  @Matches(/^(true|false)$/i, {
    message: 'lowStockOnly must be true or false',
  })
  lowStockOnly?: string;
}

export class CreateInventoryItemInput {
  @ApiProperty({
    example: 'Domestic maple vc - 3/4 UV2 4x8',
    description: 'Display name of the inventory item.',
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    example: 'Domestic maple vc 3/4 UV2',
    description: 'SKU or item code.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  sku?: string | null;

  @ApiProperty({
    example: 'Plywood',
    description: 'Top-level inventory category.',
  })
  @IsString()
  category: string;

  @ApiPropertyOptional({
    example: '3/4 UV2',
    description: 'Subcategory or series label.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  subcategory?: string | null;

  @ApiPropertyOptional({
    example: 'Domestic maple vc',
    description: 'Species or material descriptor.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  material?: string | null;

  @ApiPropertyOptional({
    example: '3/4 UV2 4x8',
    description: 'Size or dimensions.',
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

  @ApiProperty({
    example: 'Mastercraft',
    description: 'Supplier name.',
  })
  @IsString()
  supplier: string;

  @ApiProperty({
    enum: AvailabilityStatus,
    enumName: 'AvailabilityStatus',
    isArray: true,
    example: [AvailabilityStatus.IN_STOCK],
    description: 'Availability values applied to the item.',
  })
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(AvailabilityStatus, { each: true })
  availabilityStatus: AvailabilityStatus[];

  @ApiPropertyOptional({
    example: '10',
    description: 'Minimum stock reserve stored as a non-negative integer string.',
    nullable: true,
  })
  @IsOptional()
  @IsNumberString()
  minReserve?: string | null;

  @ApiPropertyOptional({
    example: '24',
    description: 'Current stock stored as a non-negative integer string.',
    nullable: true,
  })
  @IsOptional()
  @IsNumberString()
  inStock?: string | null;

  @ApiPropertyOptional({
    example: 'Stored on rack B3',
    description: 'Free-form stock notes or variants.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiProperty({
    example: true,
    description: 'Whether the item is active in inventory.',
  })
  @IsBoolean()
  active: boolean;

  @ApiPropertyOptional({
    example: '2026-06-01T00:00:00.000Z',
    description: 'Timestamp of the last price update.',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  lastPriceUpdate?: string | null;
}

export class UpdateInventoryItemInput {
  @ApiPropertyOptional({
    example: 'Domestic maple vc - 3/4 UV2 4x8',
    description: 'Display name of the inventory item.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  name?: string | null;

  @ApiPropertyOptional({
    example: 'Domestic maple vc 3/4 UV2',
    description: 'SKU or item code.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  sku?: string | null;

  @ApiPropertyOptional({
    example: 'Plywood',
    description: 'Top-level inventory category.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  category?: string | null;

  @ApiPropertyOptional({
    example: '3/4 UV2',
    description: 'Subcategory or series label.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  subcategory?: string | null;

  @ApiPropertyOptional({
    example: 'Domestic maple vc',
    description: 'Species or material descriptor.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  material?: string | null;

  @ApiPropertyOptional({
    example: '3/4 UV2 4x8',
    description: 'Size or dimensions.',
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
    example: 'Mastercraft',
    description: 'Supplier name.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  supplier?: string | null;

  @ApiPropertyOptional({
    enum: AvailabilityStatus,
    enumName: 'AvailabilityStatus',
    isArray: true,
    example: [AvailabilityStatus.IN_STOCK],
    description: 'Availability values applied to the item.',
    nullable: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @IsEnum(AvailabilityStatus, { each: true })
  availabilityStatus?: AvailabilityStatus[] | null;

  @ApiPropertyOptional({
    example: '10',
    description: 'Minimum stock reserve stored as a non-negative integer string.',
    nullable: true,
  })
  @IsOptional()
  @IsNumberString()
  minReserve?: string | null;

  @ApiPropertyOptional({
    example: '24',
    description: 'Current stock stored as a non-negative integer string.',
    nullable: true,
  })
  @IsOptional()
  @IsNumberString()
  inStock?: string | null;

  @ApiPropertyOptional({
    example: 'Stored on rack B3',
    description: 'Free-form stock notes or variants.',
    nullable: true,
  })
  @IsOptional()
  @IsString()
  notes?: string | null;

  @ApiPropertyOptional({
    example: true,
    description: 'Whether the item is active in inventory.',
    nullable: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean | null;

  @ApiPropertyOptional({
    example: '2026-06-01T00:00:00.000Z',
    description: 'Timestamp of the last price update.',
    nullable: true,
  })
  @IsOptional()
  @IsDateString()
  lastPriceUpdate?: string | null;
}

export class InventoryItemResponse {
  @ApiProperty({
    example: '50fd2ec8-5455-43a7-a1d7-4faf8300b885',
    description: 'Unique identifier for the inventory item.',
  })
  id: string;

  @ApiProperty({
    example: 'Domestic maple vc - 3/4 UV2 4x8',
    description: 'Display name of the inventory item.',
  })
  name: string;

  @ApiPropertyOptional({
    example: 'Domestic maple vc 3/4 UV2',
    description: 'SKU or item code.',
    nullable: true,
  })
  sku: string | null;

  @ApiProperty({
    example: 'Plywood',
    description: 'Top-level inventory category.',
  })
  category: string;

  @ApiPropertyOptional({
    example: '3/4 UV2',
    description: 'Subcategory or series label.',
    nullable: true,
  })
  subcategory: string | null;

  @ApiPropertyOptional({
    example: 'Domestic maple vc',
    description: 'Species or material descriptor.',
    nullable: true,
  })
  material: string | null;

  @ApiPropertyOptional({
    example: '3/4 UV2 4x8',
    description: 'Size or dimensions.',
    nullable: true,
  })
  sizeDimension: string | null;

  @ApiPropertyOptional({
    example: 'Each',
    description: 'Unit of measure.',
    nullable: true,
  })
  unitMeasure: string | null;

  @ApiProperty({
    example: 'Mastercraft',
    description: 'Supplier name.',
  })
  supplier: string;

  @ApiProperty({
    enum: AvailabilityStatus,
    enumName: 'AvailabilityStatus',
    isArray: true,
    example: [AvailabilityStatus.IN_STOCK],
    description: 'Availability values applied to the item.',
  })
  availabilityStatus: AvailabilityStatus[];

  @ApiPropertyOptional({
    example: 10,
    description: 'Minimum reserve threshold.',
    nullable: true,
  })
  minReserve: number | null;

  @ApiPropertyOptional({
    example: 24,
    description: 'Current stock count.',
    nullable: true,
  })
  inStock: number | null;

  @ApiPropertyOptional({
    example: 'Stored on rack B3',
    description: 'Free-form stock notes or variants.',
    nullable: true,
  })
  notes: string | null;

  @ApiProperty({
    example: false,
    description:
      'True when both inStock and minReserve exist and inStock is less than or equal to minReserve.',
  })
  lowStock: boolean;

  @ApiProperty({
    example: true,
    description: 'Whether the item is active in inventory.',
  })
  active: boolean;

  @ApiPropertyOptional({
    example: '2026-06-01T00:00:00.000Z',
    description: 'Timestamp of the last price update.',
    nullable: true,
  })
  lastPriceUpdate: string | null;

  @ApiProperty({
    example: '2026-06-06T12:00:00.000Z',
    description: 'Timestamp when the inventory item was created.',
  })
  createdAt: string;

  @ApiProperty({
    example: '2026-06-06T12:15:00.000Z',
    description: 'Timestamp when the inventory item was last updated.',
  })
  updatedAt: string;
}

export class InventorySummaryResponse {
  @ApiProperty({
    example: 320,
    description: 'Total number of inventory items.',
  })
  totalItems: number;

  @ApiProperty({
    example: 300,
    description: 'Number of active inventory items.',
  })
  activeItems: number;

  @ApiProperty({
    example: 20,
    description: 'Number of inactive inventory items.',
  })
  inactiveItems: number;

  @ApiProperty({
    example: 270,
    description:
      'Number of items that have at least one stock-tracking number populated.',
  })
  trackedItems: number;

  @ApiProperty({
    example: 18,
    description:
      'Number of items where both inStock and minReserve exist and inStock is less than or equal to minReserve.',
  })
  lowStockItems: number;

  @ApiProperty({
    example: 6,
    description: 'Number of items where inStock is present and equal to zero.',
  })
  outOfStockItems: number;

  @ApiProperty({
    example: 14,
    description: 'Number of distinct categories represented in inventory.',
  })
  categoriesCount: number;
}

export class CreateInventoryItemResponse {
  @ApiProperty({
    example: 'Inventory item created successfully',
    description: 'Confirmation message returned after creating the inventory item.',
  })
  message: string;

  @ApiProperty({
    type: () => InventoryItemResponse,
    description: 'The newly created inventory item.',
  })
  item: InventoryItemResponse;
}

export class UpdateInventoryItemResponse {
  @ApiProperty({
    example: 'Inventory item updated successfully',
    description: 'Confirmation message returned after updating the inventory item.',
  })
  message: string;

  @ApiProperty({
    type: () => InventoryItemResponse,
    description: 'The updated inventory item.',
  })
  item: InventoryItemResponse;
}

export class InventoryImportIssueResponse {
  @ApiProperty({
    example: 8,
    description: 'Worksheet row number where the issue occurred.',
  })
  row: number;

  @ApiProperty({
    example: 'Invalid availabilityStatus value: Backordered',
    description: 'Description of the import issue.',
  })
  reason: string;
}

export class ImportInventoryResponse {
  @ApiProperty({
    example: 'Inventory import completed',
    description: 'Summary message returned after processing the workbook.',
  })
  message: string;

  @ApiProperty({
    example: 334,
    description: 'Total number of worksheet rows evaluated after the header row.',
  })
  processedCount: number;

  @ApiProperty({
    example: 280,
    description: 'Number of new inventory items inserted.',
  })
  createdCount: number;

  @ApiProperty({
    example: 32,
    description: 'Number of existing inventory items updated.',
  })
  updatedCount: number;

  @ApiProperty({
    example: 12,
    description: 'Number of rows skipped because they were blank, section headers, or duplicates.',
  })
  skippedCount: number;

  @ApiProperty({
    example: 10,
    description: 'Number of rows rejected because validation failed.',
  })
  errorCount: number;

  @ApiProperty({
    type: () => InventoryImportIssueResponse,
    isArray: true,
    description: 'Validation errors encountered while importing rows.',
  })
  errors: InventoryImportIssueResponse[];

  @ApiProperty({
    type: () => InventoryImportIssueResponse,
    isArray: true,
    description: 'Rows skipped because they were blank, dividers, or duplicates.',
  })
  skippedRows: InventoryImportIssueResponse[];
}

export class ImportInventoryBody {
  @ApiProperty({
    type: 'string',
    format: 'binary',
    description: 'Excel workbook containing inventory rows.',
  })
  file: unknown;
}
