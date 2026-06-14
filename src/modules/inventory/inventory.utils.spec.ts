import { AvailabilityStatus } from '@prisma/client';
import {
  createRawInventoryRow,
  findInventoryHeaderRow,
  isSectionHeaderRow,
  mapInventoryImportRow,
  normalizeInventoryImportRow,
  parseNonNegativeIntegerValue,
} from './inventory.utils';

describe('inventory.utils', () => {
  it('finds the inventory header row after a title row', () => {
    const rows = [
      ['MASTERCRAFT PRODUCTS - INVENTORY BOARD'],
      [
        'Name',
        'SKU / Item Code',
        'Category',
        'Subcategory / Series',
        'Species / Material',
        'Size / Dimensions',
        'Unit of Measure',
        'Supplier',
        'Availability Status',
        'Min Reserve',
        'In Stock',
        'Notes / Variants',
        'Active',
        'Last Price Update',
      ],
    ];

    expect(findInventoryHeaderRow(rows)).toMatchObject({
      headerRowIndex: 1,
    });
  });

  it('detects section header rows', () => {
    const row = createRawInventoryRow({
      name: '  BACK BANDS',
    });

    expect(isSectionHeaderRow(row)).toBe(true);
  });

  it('parses non-negative stock values', () => {
    expect(parseNonNegativeIntegerValue('12', 'inStock')).toBe(12);
  });

  it('normalizes spreadsheet rows into inventory items', () => {
    const headerColumns = findInventoryHeaderRow([
      [
        'Name',
        'SKU / Item Code',
        'Category',
        'Subcategory / Series',
        'Species / Material',
        'Size / Dimensions',
        'Unit of Measure',
        'Supplier',
        'Availability Status',
        'Min Reserve',
        'In Stock',
        'Notes / Variants',
        'Active',
        'Last Price Update',
      ],
    ]).headerColumns;

    const row = mapInventoryImportRow(
      [
        'Back Bands - 118-BB',
        '118-BB',
        'Back Bands',
        '',
        'Poplar',
        '1-1/8" x 1-1/8"',
        'Each',
        'Mastercraft',
        'In Stock|Special Order',
        '5',
        '2',
        'Stored on rack B3',
        'Yes',
        '2026-06-01T00:00:00.000Z',
      ],
      headerColumns,
    );

    expect(normalizeInventoryImportRow(row)).toMatchObject({
      productName: 'Back Bands - 118-BB',
      productNameKey: 'back bands - 118-bb',
      itemCode: '118-BB',
      category: 'Back Bands',
      material: 'Poplar',
      availabilityStatuses: [
        AvailabilityStatus.IN_STOCK,
        AvailabilityStatus.SPECIAL_ORDER,
      ],
      minReserve: 5,
      inStock: 2,
      active: true,
    });
  });
});
