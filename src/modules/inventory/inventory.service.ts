import { Injectable } from '@nestjs/common';
import { AvailabilityStatus, Prisma, Role } from '@prisma/client';
import * as XLSX from 'xlsx';
import { extname } from 'path';
import { IAuthUser } from 'src/modules/auth/auth.types';
import { PrismaService } from 'src/services/prisma/prisma.service';
import { bad } from 'src/utils/error.utils';
import {
  CreateInventoryItemInput,
  InventoryListQuery,
  UpdateInventoryItemInput,
} from './inventory.types';
import {
  createRawInventoryRow,
  findInventoryHeaderRow,
  hasOwnProperty,
  isImportRowBlank,
  isSectionHeaderRow,
  mapInventoryImportRow,
  normalizeInventoryImportRow,
  normalizeInventoryMutationInput,
} from './inventory.utils';

const inventorySelect = {
  id: true,
  productName: true,
  productNameKey: true,
  itemCode: true,
  category: true,
  subcategory: true,
  material: true,
  sizeDimension: true,
  unitMeasure: true,
  supplier: true,
  availabilityStatuses: true,
  ourPrice: true,
  minReserve: true,
  inStock: true,
  notes: true,
  active: true,
  lastPriceUpdate: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.InventoryItemSelect;

type InventoryRecord = Prisma.InventoryItemGetPayload<{
  select: typeof inventorySelect;
}>;

type UploadedSpreadsheet = {
  originalname: string;
  buffer: Buffer;
};

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async getInventorySummary(user: IAuthUser) {
    this.ensureStaff(user);

    const items = await this.prisma.inventoryItem.findMany({
      select: {
        id: true,
        category: true,
        active: true,
        minReserve: true,
        inStock: true,
      },
    });

    const categories = new Set(
      items.map((item) => item.category.trim().toLowerCase()),
    );
    const activeItems = items.filter((item) => item.active).length;
    const trackedItems = items.filter(
      (item) => item.inStock !== null || item.minReserve !== null,
    ).length;
    const lowStockItems = items.filter((item) => this.isLowStock(item)).length;
    const outOfStockItems = items.filter(
      (item) => item.inStock !== null && item.inStock === 0,
    ).length;

    return {
      totalItems: items.length,
      activeItems,
      inactiveItems: items.length - activeItems,
      trackedItems,
      lowStockItems,
      outOfStockItems,
      categoriesCount: categories.size,
    };
  }

  async getInventoryList(query: InventoryListQuery, user: IAuthUser) {
    this.ensureStaff(user);

    const items = await this.prisma.inventoryItem.findMany({
      where: this.buildInventoryWhere(query),
      orderBy: [{ category: 'asc' }, { productName: 'asc' }],
      select: inventorySelect,
    });

    const lowStockOnly = this.parseOptionalBooleanQuery(
      query.lowStockOnly,
      'lowStockOnly',
    );
    const filteredItems =
      lowStockOnly === true
        ? items.filter((item) => this.isLowStock(item))
        : items;

    return filteredItems.map((item) => this.serializeInventoryItem(item));
  }

  async getInventoryItem(id: string, user: IAuthUser) {
    this.ensureStaff(user);

    const item = await this.prisma.inventoryItem.findUnique({
      where: { id },
      select: inventorySelect,
    });

    if (!item) bad('Inventory item not found', 404);
    return this.serializeInventoryItem(item);
  }

  async createInventoryItem(dto: CreateInventoryItemInput, user: IAuthUser) {
    this.ensureStaff(user);

    const data = normalizeInventoryImportRow(
      createRawInventoryRow(dto),
    );

    if (data.itemCode) {
      await this.ensureUniqueField('itemCode', data.itemCode);
    }
    await this.ensureUniqueField('productNameKey', data.productNameKey);

    const item = await this.prisma.inventoryItem.create({
      data,
      select: inventorySelect,
    });

    return {
      message: 'Inventory item created successfully',
      item: this.serializeInventoryItem(item),
    };
  }

  async updateInventoryItem(
    id: string,
    dto: UpdateInventoryItemInput,
    user: IAuthUser,
  ) {
    this.ensureStaff(user);

    const existingItem = await this.prisma.inventoryItem.findUnique({
      where: { id },
      select: {
        id: true,
        itemCode: true,
        productNameKey: true,
      },
    });

    if (!existingItem) bad('Inventory item not found', 404);

    const normalizedData = normalizeInventoryMutationInput(dto);
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

    const item = await this.prisma.inventoryItem.update({
      where: { id },
      data: normalizedData,
      select: inventorySelect,
    });

    return {
      message: 'Inventory item updated successfully',
      item: this.serializeInventoryItem(item),
    };
  }

  async importInventoryItems(
    file: UploadedSpreadsheet | undefined,
    user: IAuthUser,
  ) {
    this.ensureStaff(user);
    this.ensureSpreadsheetFile(file);

    const workbook = XLSX.read(file.buffer, {
      type: 'buffer',
      cellDates: true,
      dense: true,
    });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];

    if (!worksheet) bad('The uploaded workbook does not contain any worksheets');

    const rows = XLSX.utils.sheet_to_json<unknown[]>(worksheet, {
      header: 1,
      defval: null,
      raw: true,
    });

    if (!rows.length) bad('The worksheet does not contain any rows');

    const { headerRowIndex, headerColumns } = findInventoryHeaderRow(rows);
    const sourceRows = rows.slice(headerRowIndex + 1);

    if (!sourceRows.length) bad('The worksheet does not contain any data rows');

    const errors: Array<{ row: number; reason: string }> = [];
    const skippedRows: Array<{ row: number; reason: string }> = [];
    const normalizedRows: Array<{
      row: number;
      data: ReturnType<typeof normalizeInventoryImportRow>;
    }> = [];

    sourceRows.forEach((sourceRow, index) => {
      const rowNumber = headerRowIndex + index + 2;
      const rowValues = Array.isArray(sourceRow) ? sourceRow : [];
      const mappedRow = mapInventoryImportRow(rowValues, headerColumns);

      if (isImportRowBlank(mappedRow)) {
        skippedRows.push({ row: rowNumber, reason: 'Blank row' });
        return;
      }

      if (isSectionHeaderRow(mappedRow)) {
        skippedRows.push({ row: rowNumber, reason: 'Category divider row' });
        return;
      }

      try {
        normalizedRows.push({
          row: rowNumber,
          data: normalizeInventoryImportRow(mappedRow),
        });
      } catch (error) {
        errors.push({
          row: rowNumber,
          reason: this.getErrorMessage(error),
        });
      }
    });

    const existingItems = await this.findExistingInventoryItems(normalizedRows);
    const existingItemCodeMap = new Map(
      existingItems
        .filter((item) => item.itemCode)
        .map((item) => [item.itemCode as string, item]),
    );
    const existingProductNameKeyMap = new Map(
      existingItems.map((item) => [item.productNameKey, item]),
    );
    const seenItemCodes = new Set<string>();
    const seenProductNameKeys = new Set<string>();
    const itemsToCreate: Array<ReturnType<typeof normalizeInventoryImportRow>> =
      [];
    const itemsToUpdate: Array<{
      id: string;
      data: ReturnType<typeof normalizeInventoryImportRow>;
    }> = [];

    for (const row of normalizedRows) {
      const { itemCode, productNameKey } = row.data;

      if (itemCode && seenItemCodes.has(itemCode)) {
        skippedRows.push({
          row: row.row,
          reason: `Duplicate sku in import: ${itemCode}`,
        });
        continue;
      }

      if (seenProductNameKeys.has(productNameKey)) {
        skippedRows.push({
          row: row.row,
          reason: `Duplicate name in import: ${row.data.productName}`,
        });
        continue;
      }

      const matchedByItemCode = itemCode
        ? existingItemCodeMap.get(itemCode) ?? null
        : null;
      const matchedByName =
        existingProductNameKeyMap.get(productNameKey) ?? null;

      if (
        matchedByItemCode &&
        matchedByName &&
        matchedByItemCode.id !== matchedByName.id
      ) {
        errors.push({
          row: row.row,
          reason:
            'The row SKU and name match different existing inventory items',
        });
        continue;
      }

      if (itemCode) seenItemCodes.add(itemCode);
      seenProductNameKeys.add(productNameKey);

      const existingItem = matchedByItemCode ?? matchedByName;
      if (existingItem) {
        itemsToUpdate.push({
          id: existingItem.id,
          data: row.data,
        });
        continue;
      }

      itemsToCreate.push(row.data);
    }

    if (itemsToCreate.length || itemsToUpdate.length) {
      await this.prisma.$transaction(async (tx) => {
        if (itemsToCreate.length) {
          await tx.inventoryItem.createMany({
            data: itemsToCreate,
          });
        }

        for (const item of itemsToUpdate) {
          await tx.inventoryItem.update({
            where: { id: item.id },
            data: item.data,
          });
        }
      });
    }

    return {
      message: 'Inventory import completed',
      processedCount: sourceRows.length,
      createdCount: itemsToCreate.length,
      updatedCount: itemsToUpdate.length,
      skippedCount: skippedRows.length,
      errorCount: errors.length,
      errors,
      skippedRows,
    };
  }

  private ensureStaff(user: IAuthUser) {
    if (user.role !== Role.STAFF) {
      bad('Only staff users can manage inventory', 403);
    }
  }

  private buildInventoryWhere(query: InventoryListQuery) {
    const search = this.normalizeFilterValue(query.search);
    const category = this.normalizeFilterValue(query.category);
    const supplier = this.normalizeFilterValue(query.supplier);
    const active = this.parseOptionalBooleanQuery(query.active, 'active');

    const where: Prisma.InventoryItemWhereInput = {};

    if (search) {
      where.OR = [
        { productName: { contains: search, mode: 'insensitive' } },
        { itemCode: { contains: search, mode: 'insensitive' } },
        { category: { contains: search, mode: 'insensitive' } },
        { supplier: { contains: search, mode: 'insensitive' } },
        { subcategory: { contains: search, mode: 'insensitive' } },
        { material: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (category) {
      where.category = { equals: category, mode: 'insensitive' };
    }

    if (supplier) {
      where.supplier = { equals: supplier, mode: 'insensitive' };
    }

    if (query.availabilityStatus) {
      where.availabilityStatuses = {
        has: query.availabilityStatus as AvailabilityStatus,
      };
    }

    if (active !== undefined) {
      where.active = active;
    }

    return where;
  }

  private async ensureUniqueField(
    field: 'itemCode' | 'productNameKey',
    value: string,
    currentId?: string,
  ) {
    const existingItem = await this.prisma.inventoryItem.findFirst({
      where: {
        [field]: value,
        id: currentId
          ? {
              not: currentId,
            }
          : undefined,
      },
      select: {
        id: true,
      },
    });

    if (existingItem) {
      bad(`${field} already exists`);
    }
  }

  private async findExistingInventoryItems(
    rows: Array<{ data: ReturnType<typeof normalizeInventoryImportRow> }>,
  ) {
    const itemCodes = [
      ...new Set(
        rows.flatMap(({ data }) => (data.itemCode ? [data.itemCode] : [])),
      ),
    ];
    const productNameKeys = [
      ...new Set(rows.map(({ data }) => data.productNameKey)),
    ];
    const filters: Prisma.InventoryItemWhereInput[] = [];

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

    return this.prisma.inventoryItem.findMany({
      where: {
        OR: filters,
      },
      select: {
        id: true,
        itemCode: true,
        productNameKey: true,
      },
    });
  }

  private ensureSpreadsheetFile(
    file?: UploadedSpreadsheet,
  ): asserts file is UploadedSpreadsheet {
    if (!file) bad('Excel file is required');
    if (!file.buffer?.length) bad('Uploaded Excel file is empty');

    const extension = extname(file.originalname ?? '').toLowerCase();
    if (!['.xlsx', '.xls'].includes(extension)) {
      bad('Only .xlsx and .xls files are supported');
    }
  }

  private parseOptionalBooleanQuery(
    value: string | undefined,
    fieldName: string,
  ) {
    if (value === undefined) return undefined;

    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;

    bad(`${fieldName} must be true or false`);
  }

  private normalizeFilterValue(value: string | undefined) {
    return value?.trim() || undefined;
  }

  private isLowStock(item: { minReserve: number | null; inStock: number | null }) {
    if (item.minReserve === null || item.inStock === null) {
      return false;
    }

    return item.inStock <= item.minReserve;
  }

  private serializeInventoryItem(item: InventoryRecord) {
    return {
      id: item.id,
      name: item.productName,
      sku: item.itemCode,
      category: item.category,
      subcategory: item.subcategory,
      material: item.material,
      sizeDimension: item.sizeDimension,
      unitMeasure: item.unitMeasure,
      supplier: item.supplier,
      availabilityStatus: item.availabilityStatuses,
      ourPrice: item.ourPrice !== null ? Number(item.ourPrice) : null,
      minReserve: item.minReserve,
      inStock: item.inStock,
      notes: item.notes,
      lowStock: this.isLowStock(item),
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
