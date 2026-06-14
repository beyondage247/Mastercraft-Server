import { AvailabilityStatus, Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { bad } from 'src/utils/error.utils';

export const SERVICE_IMPORT_COLUMNS = [
  'productName',
  'itemCode',
  'subcategory',
  'supplierCost',
  'ourPrice',
  'markUp',
  'availabilityStatus',
  'category',
  'supplier',
  'sizeDimension',
  'unitMeasure',
  'styleProfile',
  'supplierCatalogue',
  'active',
  'lastPriceUpdate',
] as const;

export type ServiceImportColumn = (typeof SERVICE_IMPORT_COLUMNS)[number];

export type RawCatalogItemRow = Record<ServiceImportColumn, unknown>;

export type CatalogItemMutationPayload = Partial<
  Record<ServiceImportColumn, unknown>
>;

export type NormalizedCatalogItemInput = {
  productName: string;
  productNameKey: string;
  itemCode: string | null;
  subcategory: string | null;
  supplierCost: Prisma.Decimal | null;
  ourPrice: Prisma.Decimal | null;
  markUp: Prisma.Decimal | null;
  availabilityStatuses: AvailabilityStatus[];
  category: string;
  supplier: string;
  sizeDimension: string | null;
  unitMeasure: string | null;
  styleProfile: string | null;
  supplierCatalogue: string | null;
  active: boolean;
  lastPriceUpdate: Date | null;
};

export type NormalizedCatalogItemUpdateInput =
  Partial<NormalizedCatalogItemInput>;

const SERVICE_IMPORT_HEADER_MAP = new Map<string, ServiceImportColumn>(
  SERVICE_IMPORT_COLUMNS.map((column) => [column.toLowerCase(), column]),
);

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

export function normalizeProductNameKey(productName: string): string {
  return productName
    .normalize('NFKC')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function normalizeOptionalString(value: unknown): string | null {
  if (value === null || value === undefined) return null;

  const normalized = String(value).trim();
  return normalized ? normalized : null;
}

export function isImportRowBlank(row: Partial<RawCatalogItemRow>): boolean {
  return SERVICE_IMPORT_COLUMNS.every((column) => {
    const value = row[column];
    if (value === null || value === undefined) return true;
    if (typeof value === 'string') return !value.trim();
    return false;
  });
}

export function mapImportRow(source: Record<string, unknown>): RawCatalogItemRow {
  const row = Object.fromEntries(
    SERVICE_IMPORT_COLUMNS.map((column) => [column, null]),
  ) as RawCatalogItemRow;

  for (const [header, value] of Object.entries(source)) {
    const column = SERVICE_IMPORT_HEADER_MAP.get(header.trim().toLowerCase());
    if (column) row[column] = value;
  }

  return row;
}

export function parseCurrencyValue(
  value: unknown,
  fieldName: string,
): Prisma.Decimal | null {
  return parseDecimalValue(value, fieldName, /[$,\s]/g);
}

export function parsePercentValue(
  value: unknown,
  fieldName: string,
): Prisma.Decimal | null {
  return parseDecimalValue(value, fieldName, /[%,$\s]/g);
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

export function normalizeCatalogItemImportRow(
  row: RawCatalogItemRow,
): NormalizedCatalogItemInput {
  const productName = requireStringField(row.productName, 'productName');
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
    itemCode: normalizeOptionalString(row.itemCode),
    subcategory: normalizeOptionalString(row.subcategory),
    supplierCost: parseCurrencyValue(row.supplierCost, 'supplierCost'),
    ourPrice: parseCurrencyValue(row.ourPrice, 'ourPrice'),
    markUp: parsePercentValue(row.markUp, 'markUp'),
    availabilityStatuses,
    category,
    supplier,
    sizeDimension: normalizeOptionalString(row.sizeDimension),
    unitMeasure: normalizeOptionalString(row.unitMeasure),
    styleProfile: normalizeOptionalString(row.styleProfile),
    supplierCatalogue: normalizeOptionalString(row.supplierCatalogue),
    active: parseBooleanValue(row.active, 'active'),
    lastPriceUpdate: parseExcelDateValue(
      row.lastPriceUpdate,
      'lastPriceUpdate',
    ),
  };
}

export function normalizeCatalogItemUpdateInput(
  payload: CatalogItemMutationPayload,
): NormalizedCatalogItemUpdateInput {
  const data: NormalizedCatalogItemUpdateInput = {};

  if (payload.productName !== undefined) {
    const productName = requireStringField(payload.productName, 'productName');
    data.productName = productName;
    data.productNameKey = normalizeProductNameKey(productName);
  }

  if (payload.itemCode !== undefined) {
    data.itemCode = normalizeOptionalString(payload.itemCode);
  }

  if (payload.subcategory !== undefined) {
    data.subcategory = normalizeOptionalString(payload.subcategory);
  }

  if (payload.supplierCost !== undefined) {
    data.supplierCost = parseCurrencyValue(payload.supplierCost, 'supplierCost');
  }

  if (payload.ourPrice !== undefined) {
    data.ourPrice = parseCurrencyValue(payload.ourPrice, 'ourPrice');
  }

  if (payload.markUp !== undefined) {
    data.markUp = parsePercentValue(payload.markUp, 'markUp');
  }

  if (payload.availabilityStatus !== undefined) {
    const availabilityStatuses = parseAvailabilityStatuses(
      payload.availabilityStatus,
      'availabilityStatus',
    );

    if (!availabilityStatuses?.length) bad('availabilityStatus is required');
    data.availabilityStatuses = availabilityStatuses;
  }

  if (payload.category !== undefined) {
    data.category = requireStringField(payload.category, 'category');
  }

  if (payload.supplier !== undefined) {
    data.supplier = requireStringField(payload.supplier, 'supplier');
  }

  if (payload.sizeDimension !== undefined) {
    data.sizeDimension = normalizeOptionalString(payload.sizeDimension);
  }

  if (payload.unitMeasure !== undefined) {
    data.unitMeasure = normalizeOptionalString(payload.unitMeasure);
  }

  if (payload.styleProfile !== undefined) {
    data.styleProfile = normalizeOptionalString(payload.styleProfile);
  }

  if (payload.supplierCatalogue !== undefined) {
    data.supplierCatalogue = normalizeOptionalString(payload.supplierCatalogue);
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

function requireStringField(value: unknown, fieldName: string): string {
  const normalized = normalizeOptionalString(value);
  if (!normalized) bad(`${fieldName} is required`);
  return normalized;
}

function parseDecimalValue(
  value: unknown,
  fieldName: string,
  stripPattern: RegExp,
): Prisma.Decimal | null {
  if (value === null || value === undefined) return null;

  if (value instanceof Prisma.Decimal) return value;

  const normalized = String(value).replace(stripPattern, '').trim();
  if (!normalized) return null;

  if (!/^-?\d+(\.\d+)?$/.test(normalized)) {
    bad(`Invalid ${fieldName} value`);
  }

  return new Prisma.Decimal(normalized);
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
