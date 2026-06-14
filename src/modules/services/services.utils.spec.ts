import { AvailabilityStatus } from '@prisma/client';
import {
  mapImportRow,
  normalizeCatalogItemImportRow,
  normalizeOptionalString,
  parseAvailabilityStatuses,
  parseBooleanValue,
  parseCurrencyValue,
  parseExcelDateValue,
  parsePercentValue,
} from './services.utils';

describe('services.utils', () => {
  it('normalizes currency values by stripping symbols and commas', () => {
    expect(parseCurrencyValue('$1,234.50', 'supplierCost')?.toString()).toBe(
      '1234.5',
    );
  });

  it('normalizes percent values by stripping the percent sign', () => {
    expect(parsePercentValue('40%', 'markUp')?.toString()).toBe('40');
  });

  it('normalizes yes/no strings into booleans', () => {
    expect(parseBooleanValue('Yes', 'active')).toBe(true);
    expect(parseBooleanValue('No', 'active')).toBe(false);
  });

  it('normalizes pipe-delimited availability values into enums', () => {
    expect(
      parseAvailabilityStatuses(
        'Email for Quote|In Stock|Special Order',
        'availabilityStatus',
      ),
    ).toEqual([
      AvailabilityStatus.EMAIL_FOR_QUOTE,
      AvailabilityStatus.IN_STOCK,
      AvailabilityStatus.SPECIAL_ORDER,
    ]);
  });

  it('treats blank strings as null', () => {
    expect(normalizeOptionalString('   ')).toBeNull();
  });

  it('parses Excel date serial values into UTC dates', () => {
    expect(parseExcelDateValue(1, 'lastPriceUpdate')?.toISOString()).toBe(
      '1900-01-01T00:00:00.000Z',
    );
  });

  it('normalizes spreadsheet rows into catalog items', () => {
    const row = mapImportRow({
      PRODUCTNAME: 'Door A',
      itemCode: 'KD-111',
      subcategory: 'Raised Panel',
      supplierCost: '$219',
      ourPrice: '$306.6',
      markUp: '40%',
      availabilityStatus: 'In Stock|Special Order',
      category: 'Interior Doors',
      supplier: 'Koch Doors',
      sizeDimension: `1'0 up to 1'5`,
      unitMeasure: 'Each',
      styleProfile: '8728 - V-GROOVE',
      supplierCatalogue: '111',
      active: 'Yes',
      lastPriceUpdate: '2026-05-24T00:00:00.000Z',
    });

    expect(normalizeCatalogItemImportRow(row)).toMatchObject({
      productName: 'Door A',
      productNameKey: 'door a',
      itemCode: 'KD-111',
      supplierCost: expect.anything(),
      ourPrice: expect.anything(),
      markUp: expect.anything(),
      availabilityStatuses: [
        AvailabilityStatus.IN_STOCK,
        AvailabilityStatus.SPECIAL_ORDER,
      ],
      category: 'Interior Doors',
      supplier: 'Koch Doors',
      active: true,
    });
  });
});
