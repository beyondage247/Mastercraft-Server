import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { extname } from 'path';
import { PrismaService } from 'src/services/prisma/prisma.service';
import { bad } from 'src/utils/error.utils';
import { CreateCatalogItemInput, UpdateCatalogItemInput } from './services.types';
import {
  RawCatalogItemRow,
  hasOwnProperty,
  isImportRowBlank,
  mapImportRow,
  normalizeCatalogItemImportRow,
  normalizeCatalogItemUpdateInput,
  normalizeProductNameKey,
  normalizeOptionalString,
} from './services.utils';

const catalogItemSelect = {
  id: true,
  productName: true,
  productNameKey: true,
  itemCode: true,
  subcategory: true,
  material: true,
  supplierCost: true,
  ourPrice: true,
  markUp: true,
  availabilityStatuses: true,
  category: true,
  supplier: true,
  sizeDimension: true,
  unitMeasure: true,
  styleProfile: true,
  supplierCatalogue: true,
  active: true,
  lastPriceUpdate: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.CatalogItemSelect;

type CatalogItemRecord = Prisma.CatalogItemGetPayload<{
  select: typeof catalogItemSelect;
}>;

type UploadedSpreadsheet = {
  originalname: string;
  buffer: Buffer;
};

@Injectable()
export class ServicesService {
  constructor(private readonly prisma: PrismaService) {}

  async getCatalogItemList() {
    const items = await this.prisma.catalogItem.findMany({
      orderBy: [{ productName: 'asc' }, { createdAt: 'desc' }],
      select: catalogItemSelect,
    });

    return items.map((item) => this.serializeCatalogItem(item));
  }

  async getCatalogItem(id: string) {
    const item = await this.prisma.catalogItem.findUnique({
      where: { id },
      select: catalogItemSelect,
    });

    if (!item) bad('Catalog item not found', 404);
    return this.serializeCatalogItem(item);
  }

  async createCatalogItem(dto: CreateCatalogItemInput) {
    const productName = dto.productName.trim();
    const productNameKey = normalizeProductNameKey(productName);
    const itemCode = normalizeOptionalString(dto.itemCode);

    if (itemCode) {
      await this.ensureUniqueField('itemCode', itemCode);
    }
    await this.ensureUniqueField('productNameKey', productNameKey);

    const data = normalizeCatalogItemImportRow({
      productName,
      itemCode,
      subcategory: dto.subcategory ?? null,
      material: dto.material ?? null,
      supplierCost: dto.supplierCost ?? null,
      ourPrice: dto.ourPrice ?? null,
      markUp: dto.markUp ?? null,
      availabilityStatus: dto.availabilityStatus,
      category: dto.category,
      supplier: dto.supplier,
      sizeDimension: dto.sizeDimension ?? null,
      unitMeasure: dto.unitMeasure ?? null,
      styleProfile: dto.styleProfile ?? null,
      supplierCatalogue: dto.supplierCatalogue ?? null,
      active: dto.active,
      lastPriceUpdate: dto.lastPriceUpdate ?? null,
    });

    const item = await this.prisma.catalogItem.create({
      data,
      select: catalogItemSelect,
    });

    return {
      message: 'Catalog item created successfully',
      item: this.serializeCatalogItem(item),
    };
  }

  async updateCatalogItem(id: string, dto: UpdateCatalogItemInput) {
    const existingItem = await this.prisma.catalogItem.findUnique({
      where: { id },
      select: {
        id: true,
        itemCode: true,
        productNameKey: true,
      },
    });

    if (!existingItem) bad('Catalog item not found', 404);

    const normalizedData = normalizeCatalogItemUpdateInput(dto);
    if (!Object.keys(normalizedData).length) {
      bad('At least one update field is required');
    }

    if (
      hasOwnProperty(normalizedData, 'itemCode') &&
      normalizedData.itemCode &&
      normalizedData.itemCode !== existingItem.itemCode
    ) {
      await this.ensureUniqueField('itemCode', normalizedData.itemCode, id);
    }

    if (
      hasOwnProperty(normalizedData, 'productNameKey') &&
      normalizedData.productNameKey &&
      normalizedData.productNameKey !== existingItem.productNameKey
    ) {
      await this.ensureUniqueField(
        'productNameKey',
        normalizedData.productNameKey,
        id,
      );
    }

    const item = await this.prisma.catalogItem.update({
      where: { id },
      data: normalizedData,
      select: catalogItemSelect,
    });

    return {
      message: 'Catalog item updated successfully',
      item: this.serializeCatalogItem(item),
    };
  }

  async importCatalogItems(file?: UploadedSpreadsheet) {
    this.ensureSpreadsheetFile(file);

    const workbook = XLSX.read(file.buffer, {
      type: 'buffer',
      cellDates: true,
      dense: true,
    });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    if (!worksheet) bad('The uploaded workbook does not contain any worksheets');

    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
      defval: null,
      raw: true,
    });

    if (!rows.length) bad('The worksheet does not contain any data rows');

    const errors: Array<{ row: number; reason: string }> = [];
    const skippedRows: Array<{ row: number; reason: string }> = [];
    const normalizedRows: Array<{
      row: number;
      data: ReturnType<typeof normalizeCatalogItemImportRow>;
    }> = [];

    rows.forEach((sourceRow, index) => {
      const rowNumber = index + 2;
      const mappedRow = mapImportRow(sourceRow);

      if (isImportRowBlank(mappedRow)) {
        skippedRows.push({ row: rowNumber, reason: 'Blank row' });
        return;
      }

      try {
        normalizedRows.push({
          row: rowNumber,
          data: normalizeCatalogItemImportRow(mappedRow as RawCatalogItemRow),
        });
      } catch (error) {
        errors.push({
          row: rowNumber,
          reason: this.getErrorMessage(error),
        });
      }
    });

    const existingItems = await this.findExistingCatalogItems(normalizedRows);
    const existingItemCodes = new Set(
      existingItems.flatMap((item) => (item.itemCode ? [item.itemCode] : [])),
    );
    const existingProductNameKeys = new Set(
      existingItems.map((item) => item.productNameKey),
    );
    const seenItemCodes = new Set<string>();
    const seenProductNameKeys = new Set<string>();
    const itemsToCreate: Array<
      ReturnType<typeof normalizeCatalogItemImportRow>
    > = [];

    for (const row of normalizedRows) {
      const { itemCode, productNameKey } = row.data;

      if (itemCode) {
        if (existingItemCodes.has(itemCode) || seenItemCodes.has(itemCode)) {
          skippedRows.push({
            row: row.row,
            reason: `Duplicate itemCode: ${itemCode}`,
          });
          continue;
        }
      }

      if (
        existingProductNameKeys.has(productNameKey) ||
        seenProductNameKeys.has(productNameKey)
      ) {
        skippedRows.push({
          row: row.row,
          reason: `Duplicate productName: ${row.data.productName}`,
        });
        continue;
      }

      if (itemCode) seenItemCodes.add(itemCode);
      seenProductNameKeys.add(productNameKey);
      itemsToCreate.push(row.data);
    }

    if (itemsToCreate.length) {
      await this.prisma.catalogItem.createMany({
        data: itemsToCreate,
      });
    }

    return {
      message: 'Catalog import completed',
      processedCount: rows.length,
      importedCount: itemsToCreate.length,
      skippedCount: skippedRows.length,
      errorCount: errors.length,
      errors,
      skippedRows,
    };
  }

  private async ensureUniqueField(
    field: 'itemCode' | 'productNameKey',
    value: string,
    currentId?: string,
  ) {
    const existingItem = await this.prisma.catalogItem.findFirst({
      where: {
        [field]: value,
        id: currentId ? { not: currentId } : undefined,
      },
      select: {
        id: true,
      },
    });

    if (existingItem) {
      bad(`${field} already exists`);
    }
  }

  private async findExistingCatalogItems(
    rows: Array<{ data: ReturnType<typeof normalizeCatalogItemImportRow> }>,
  ) {
    const itemCodes = [...new Set(rows.flatMap(({ data }) => data.itemCode || []))];
    const productNameKeys = [
      ...new Set(rows.map(({ data }) => data.productNameKey)),
    ];

    const filters: Prisma.CatalogItemWhereInput[] = [];

    if (itemCodes.length) {
      filters.push({
        itemCode: {
          in: itemCodes,
        },
      });
    }

    if (productNameKeys.length) {
      filters.push({
        productNameKey: {
          in: productNameKeys,
        },
      });
    }

    if (!filters.length) return [];

    return this.prisma.catalogItem.findMany({
      where: {
        OR: filters,
      },
      select: {
        itemCode: true,
        productNameKey: true,
      },
    });
  }

  private ensureSpreadsheetFile(file?: UploadedSpreadsheet): asserts file is UploadedSpreadsheet {
    if (!file) bad('Excel file is required');
    if (!file.buffer?.length) bad('Uploaded Excel file is empty');

    const extension = extname(file.originalname ?? '').toLowerCase();
    if (!['.xlsx', '.xls'].includes(extension)) {
      bad('Only .xlsx and .xls files are supported');
    }
  }

  private serializeCatalogItem(item: CatalogItemRecord) {
    return {
      id: item.id,
      productName: item.productName,
      itemCode: item.itemCode,
      subcategory: item.subcategory,
      material: item.material,
      supplierCost: item.supplierCost?.toString() ?? null,
      ourPrice: item.ourPrice?.toString() ?? null,
      markUp: item.markUp?.toString() ?? null,
      availabilityStatus: item.availabilityStatuses,
      category: item.category,
      supplier: item.supplier,
      sizeDimension: item.sizeDimension,
      unitMeasure: item.unitMeasure,
      styleProfile: item.styleProfile,
      supplierCatalogue: item.supplierCatalogue,
      active: item.active,
      lastPriceUpdate: item.lastPriceUpdate?.toISOString() ?? null,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    };
  }

  private getErrorMessage(error: unknown) {
    if (error instanceof Error) return error.message;
    return 'Invalid row data';
  }
}
