import { AvailabilityStatus } from '@prisma/client';
import * as XLSX from 'xlsx';
import { bad } from 'src/utils/error.utils';

export const INVENTORY_IMPORT_COLUMNS = [
  'name',
  'sku',
  'category',
  'subcategory',
  'material',
  'sizeDimension',
  'unitMeasure',
  'supplier',
  'availabilityStatus',
  'minReserve',
  'inStock',
  'notes',
  'active',
  'lastPriceUpdate',
] as const;

export type InventoryImportColumn = (typeof INVENTORY_IMPORT_COLUMNS)[number];

export type RawInventoryRow = Record<InventoryImportColumn, unknown>;

export type InventoryMutationPayload = Partial<
  Record<InventoryImportColumn, unknown>
>;

export type NormalizedInventoryInput = {
  productName: string;
  productNameKey: string;
  itemCode: string | null;
  category: string;
  subcategory: string | null;
  material: string | null;
  sizeDimension: string | null;
  unitMeasure: string | null;
  supplier: string;
  availabilityStatuses: AvailabilityStatus[];
  minReserve: number | null;
  inStock: number | null;
  notes: string | null;
  active: boolean;
  lastPriceUpdate: Date | null;
};

export type NormalizedInventoryUpdateInput = Partial<NormalizedInventoryInput>;

const INVENTORY_HEADER_ALIASES = new Map<string, InventoryImportColumn>([
  ['name', 'name'],
  ['product name', 'name'],
  ['sku', 'sku'],
  ['sku / item code', 'sku'],
  ['sku/item code', 'sku'],
  ['item code', 'sku'],
  ['category', 'category'],
  ['subcategory', 'subcategory'],
  ['subcategory / series', 'subcategory'],
  ['subcategory/series', 'subcategory'],
  ['series', 'subcategory'],
  ['species / material', 'material'],
  ['species/material', 'material'],
  ['material', 'material'],
  ['size / dimensions', 'sizeDimension'],
  ['size/dimensions', 'sizeDimension'],
  ['size', 'sizeDimension'],
  ['dimensions', 'sizeDimension'],
  ['unit of measure', 'unitMeasure'],
  ['unit measure', 'unitMeasure'],
  ['supplier', 'supplier'],
  ['availability status', 'availabilityStatus'],
  ['availability', 'availabilityStatus'],
  ['min reserve', 'minReserve'],
  ['in stock', 'inStock'],
  ['notes / variants', 'notes'],
  ['notes/variants', 'notes'],
  ['notes', 'notes'],
  ['active', 'active'],
  ['last price update', 'lastPriceUpdate'],
]);

const REQUIRED_INVENTORY_HEADERS: InventoryImportColumn[] = [
  'name',
  'category',
  'supplier',
  'availabilityStatus',
  'active',
];

const AVAILABILITY_STATUS_MAP = new Map<string, AvailabilityStatus>([
  ['email for quote', AvailabilityStatus.EMAIL_FOR_QUOTE],
  ['email_for_quote', AvailabilityStatus.EMAIL_FOR_QUOTE],
  ['in stock', AvailabilityStatus.IN_STOCK],
  ['in_stock', AvailabilityStatus.IN_STOCK],
  ['special order', AvailabilityStatus.SPECIAL_ORDER],
  ['special_order', AvailabilityStatus.SPECIAL_ORDER],
]);

const BOOLEAN_VALUE_MAP = new Map<string, boolean>([
  ['yes', true],
  ['true', true],
  ['1', true],
  ['no', false],
  ['false', false],
  ['0', false],
]);

export function hasOwnProperty<T extends object>(
  value: T,
  key: PropertyKey,
): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

export function normalizeOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

export function normalizeProductNameKey(productName: string): string {
  return productName
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function createRawInventoryRow(
  payload: InventoryMutationPayload,
): RawInventoryRow {
  const row = Object.fromEntries(
    INVENTORY_IMPORT_COLUMNS.map((column) => [column, null]),
  ) as RawInventoryRow;

  for (const column of INVENTORY_IMPORT_COLUMNS) {
    if (hasOwnProperty(payload, column)) {
      row[column] = payload[column] ?? null;
    }
  }

  return row;
}

export function findInventoryHeaderRow(rows: unknown[][]) {
  for (let index = 0; index < rows.length; index += 1) {
    const headerColumns = mapInventoryHeaderColumns(rows[index] ?? []);
    const hasRequiredHeaders = REQUIRED_INVENTORY_HEADERS.every((column) =>
      [...headerColumns.values()].includes(column),
    );

    if (hasRequiredHeaders) {
      return { headerRowIndex: index, headerColumns };
    }
  }

  bad('Could not find the inventory header row in the worksheet');
}

export function mapInventoryImportRow(
  values: unknown[],
  headerColumns: Map<number, InventoryImportColumn>,
): RawInventoryRow {
  const row = createRawInventoryRow({});

  for (const [index, column] of headerColumns.entries()) {
    row[column] = values[index] ?? null;
  }

  return row;
}

export function isImportRowBlank(row: Partial<RawInventoryRow>): boolean {
  return INVENTORY_IMPORT_COLUMNS.every((column) => {
    const value = row[column];
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return !value.trim();
    return false;
  });
}

export function isSectionHeaderRow(row: Partial<RawInventoryRow>): boolean {
  const name = normalizeOptionalString(row.name);
  if (!name) return false;

  return INVENTORY_IMPORT_COLUMNS.filter((column) => column !== 'name').every(
    (column) => {
      const value = row[column];
      if (value === null || value === undefined) return true;
      if (typeof value === 'string') return !value.trim();
      return false;
    },
  );
}

export function parseAvailabilityStatuses(
  value: unknown,
  fieldName: string,
): AvailabilityStatus[] | null {
  if (value === null || value === undefined) return null;

  const tokens = Array.isArray(value)
    ? value
    : String(value)
        .split('|')
        .map((item) => item.trim())
        .filter(Boolean);

  if (!tokens.length) return null;

  const normalizedStatuses = tokens.map((token) => {
    const lookupKey = String(token).trim().toLowerCase().replace(/-/g, ' ');
    const status =
      AVAILABILITY_STATUS_MAP.get(lookupKey) ??
      AVAILABILITY_STATUS_MAP.get(lookupKey.replace(/\s+/g, '_'));

    if (!status) {
      bad(`Invalid ${fieldName} value: ${token}`);
    }

    return status;
  });

  return [...new Set(normalizedStatuses)];
}

export function parseBooleanValue(value: unknown, fieldName: string): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number' && (value === 0 || value === 1)) {
    return Boolean(value);
  }

  const normalized = normalizeOptionalString(value);
  if (!normalized) bad(`${fieldName} is required`);

  const booleanValue = BOOLEAN_VALUE_MAP.get(normalized.toLowerCase());
  if (booleanValue === undefined) {
    bad(`Invalid ${fieldName} value: ${normalized}`);
  }

  return booleanValue;
}

export function parseNonNegativeIntegerValue(
  value: unknown,
  fieldName: string,
): number | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'number') {
    if (!Number.isInteger(value) || value < 0) {
      bad(`${fieldName} must be a non-negative integer`);
    }
    return value;
  }

  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;

  if (!/^\d+$/.test(normalized)) {
    bad(`${fieldName} must be a non-negative integer`);
  }

  return Number(normalized);
}

export function parseExcelDateValue(
  value: unknown,
  fieldName: string,
): Date | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) bad(`Invalid ${fieldName} value`);
    return value;
  }

  if (typeof value === 'number') {
    return parseExcelDateSerial(value, fieldName);
  }

  const normalized = normalizeOptionalString(value);
  if (!normalized) return null;

  if (/^\d+(\.\d+)?$/.test(normalized)) {
    return parseExcelDateSerial(Number(normalized), fieldName);
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) bad(`Invalid ${fieldName} value`);
  return parsed;
}

export function normalizeInventoryImportRow(
  row: RawInventoryRow,
): NormalizedInventoryInput {
  const productName = requireStringField(row.name, 'name');
  const category = requireStringField(row.category, 'category');
  const supplier = requireStringField(row.supplier, 'supplier');
  const availabilityStatuses = parseAvailabilityStatuses(
    row.availabilityStatus,
    'availabilityStatus',
  );

  if (!availabilityStatuses?.length) bad('availabilityStatus is required');

  return {
    productName,
    productNameKey: normalizeProductNameKey(productName),
    itemCode: normalizeOptionalString(row.sku),
    category,
    subcategory: normalizeOptionalString(row.subcategory),
    material: normalizeOptionalString(row.material),
    sizeDimension: normalizeOptionalString(row.sizeDimension),
    unitMeasure: normalizeOptionalString(row.unitMeasure),
    supplier,
    availabilityStatuses,
    minReserve: parseNonNegativeIntegerValue(row.minReserve, 'minReserve'),
    inStock: parseNonNegativeIntegerValue(row.inStock, 'inStock'),
    notes: normalizeOptionalString(row.notes),
    active: parseBooleanValue(row.active, 'active'),
    lastPriceUpdate: parseExcelDateValue(
      row.lastPriceUpdate,
      'lastPriceUpdate',
    ),
  };
}

export function normalizeInventoryMutationInput(
  payload: InventoryMutationPayload,
): NormalizedInventoryUpdateInput {
  const data: NormalizedInventoryUpdateInput = {};

  if (payload.name !== undefined) {
    const productName = requireStringField(payload.name, 'name');
    data.productName = productName;
    data.productNameKey = normalizeProductNameKey(productName);
  }

  if (payload.sku !== undefined) {
    data.itemCode = normalizeOptionalString(payload.sku);
  }

  if (payload.category !== undefined) {
    data.category = requireStringField(payload.category, 'category');
  }

  if (payload.subcategory !== undefined) {
    data.subcategory = normalizeOptionalString(payload.subcategory);
  }

  if (payload.material !== undefined) {
    data.material = normalizeOptionalString(payload.material);
  }

  if (payload.sizeDimension !== undefined) {
    data.sizeDimension = normalizeOptionalString(payload.sizeDimension);
  }

  if (payload.unitMeasure !== undefined) {
    data.unitMeasure = normalizeOptionalString(payload.unitMeasure);
  }

  if (payload.supplier !== undefined) {
    data.supplier = requireStringField(payload.supplier, 'supplier');
  }

  if (payload.availabilityStatus !== undefined) {
    const availabilityStatuses = parseAvailabilityStatuses(
      payload.availabilityStatus,
      'availabilityStatus',
    );

    if (!availabilityStatuses?.length) bad('availabilityStatus is required');
    data.availabilityStatuses = availabilityStatuses;
  }

  if (payload.minReserve !== undefined) {
    data.minReserve = parseNonNegativeIntegerValue(
      payload.minReserve,
      'minReserve',
    );
  }

  if (payload.inStock !== undefined) {
    data.inStock = parseNonNegativeIntegerValue(payload.inStock, 'inStock');
  }

  if (payload.notes !== undefined) {
    data.notes = normalizeOptionalString(payload.notes);
  }

  if (payload.active !== undefined) {
    data.active = parseBooleanValue(payload.active, 'active');
  }

  if (payload.lastPriceUpdate !== undefined) {
    data.lastPriceUpdate = parseExcelDateValue(
      payload.lastPriceUpdate,
      'lastPriceUpdate',
    );
  }

  return data;
}

function mapInventoryHeaderColumns(values: unknown[]) {
  const headerColumns = new Map<number, InventoryImportColumn>();

  values.forEach((value, index) => {
    const normalized = normalizeOptionalString(value)
      ?.toLowerCase()
      .replace(/\s+/g, ' ');
    if (!normalized) return;

    const column = INVENTORY_HEADER_ALIASES.get(normalized);
    if (column) {
      headerColumns.set(index, column);
    }
  });

  return headerColumns;
}

function requireStringField(value: unknown, fieldName: string): string {
  const normalized = normalizeOptionalString(value);
  if (!normalized) bad(`${fieldName} is required`);
  return normalized;
}

function parseExcelDateSerial(value: number, fieldName: string): Date {
  const parsed = XLSX.SSF.parse_date_code(value);
  if (!parsed) bad(`Invalid ${fieldName} value`);

  return new Date(
    Date.UTC(
      parsed.y,
      parsed.m - 1,
      parsed.d,
      parsed.H ?? 0,
      parsed.M ?? 0,
      Math.floor(parsed.S ?? 0),
    ),
  );
}
