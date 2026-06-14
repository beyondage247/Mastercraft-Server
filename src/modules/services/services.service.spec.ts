import { Prisma } from '@prisma/client';
import * as XLSX from 'xlsx';
import { ServicesService } from './services.service';
import { normalizeProductNameKey } from './services.utils';

function buildWorkbook(rows: Record<string, unknown>[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Catalog');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

describe('ServicesService', () => {
  const prisma = {
    catalogItem: {
      findMany: jest.fn(),
      createMany: jest.fn(),
    },
  };

  let service: ServicesService;

  beforeEach(() => {
    prisma.catalogItem.findMany.mockReset();
    prisma.catalogItem.createMany.mockReset();
    service = new ServicesService(prisma as any);
  });

  it('imports valid rows, skips duplicates, and reports invalid rows', async () => {
    prisma.catalogItem.findMany.mockResolvedValue([
      {
        itemCode: 'KD-111',
        productNameKey: normalizeProductNameKey('Existing Code Item'),
      },
      {
        itemCode: null,
        productNameKey: normalizeProductNameKey('Fallback Name Item'),
      },
    ]);
    prisma.catalogItem.createMany.mockResolvedValue({ count: 1 });

    const buffer = buildWorkbook([
      {
        productName: 'New Door',
        itemCode: 'KD-200',
        category: 'Interior Doors',
        supplier: 'Koch Doors',
        availabilityStatus: 'In Stock',
        active: 'Yes',
      },
      {
        productName: 'Existing Code Item',
        itemCode: 'KD-111',
        category: 'Interior Doors',
        supplier: 'Koch Doors',
        availabilityStatus: 'In Stock',
        active: 'Yes',
      },
      {
        productName: 'Fallback Name Item',
        itemCode: '',
        category: 'Interior Doors',
        supplier: 'Koch Doors',
        availabilityStatus: 'Special Order',
        active: 'Yes',
      },
      {
        productName: '',
        itemCode: 'BAD-1',
        category: 'Interior Doors',
        supplier: 'Koch Doors',
        availabilityStatus: 'In Stock',
        active: 'Yes',
      },
    ]);

    const result = await service.importCatalogItems({
      originalname: 'catalog.xlsx',
      buffer: Buffer.from(buffer),
    });

    expect(prisma.catalogItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          productName: 'New Door',
          productNameKey: 'new door',
          itemCode: 'KD-200',
          category: 'Interior Doors',
          supplier: 'Koch Doors',
          availabilityStatuses: ['IN_STOCK'],
          active: true,
        }),
      ],
    });

    expect(result).toMatchObject({
      processedCount: 4,
      importedCount: 1,
      skippedCount: 2,
      errorCount: 1,
    });
    expect(result.skippedRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ row: 3, reason: 'Duplicate itemCode: KD-111' }),
        expect.objectContaining({
          row: 4,
          reason: 'Duplicate productName: Fallback Name Item',
        }),
      ]),
    );
    expect(result.errors).toEqual([
      expect.objectContaining({ row: 5, reason: 'productName is required' }),
    ]);
  });

  it('updates catalog items using normalized values', async () => {
    const updatedAt = new Date('2026-05-24T10:35:00.000Z');
    const createdAt = new Date('2026-05-24T10:30:00.000Z');
    const update = jest.fn().mockResolvedValue({
      id: 'item-1',
      productName: 'Door A',
      productNameKey: 'door a',
      itemCode: 'KD-111',
      subcategory: null,
      supplierCost: new Prisma.Decimal('219'),
      ourPrice: new Prisma.Decimal('320.4'),
      markUp: new Prisma.Decimal('46'),
      availabilityStatuses: ['IN_STOCK'],
      category: 'Interior Doors',
      supplier: 'Koch Doors',
      sizeDimension: null,
      unitMeasure: null,
      styleProfile: null,
      supplierCatalogue: null,
      active: true,
      lastPriceUpdate: null,
      createdAt,
      updatedAt,
    });
    const findUnique = jest
      .fn()
      .mockResolvedValueOnce({
        id: 'item-1',
        itemCode: 'KD-111',
        productNameKey: 'door a',
      })
      .mockResolvedValueOnce(null);
    const findFirst = jest.fn().mockResolvedValue(null);

    service = new ServicesService({
      catalogItem: {
        findUnique,
        findFirst,
        update,
      },
    } as any);

    const result = await service.updateCatalogItem('item-1', {
      ourPrice: '320.4',
      markUp: '46%',
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: expect.objectContaining({
        ourPrice: expect.any(Prisma.Decimal),
        markUp: expect.any(Prisma.Decimal),
      }),
      select: expect.any(Object),
    });
    expect(result).toMatchObject({
      message: 'Catalog item updated successfully',
      item: expect.objectContaining({
        id: 'item-1',
        ourPrice: '320.4',
        markUp: '46',
      }),
    });
  });
});
