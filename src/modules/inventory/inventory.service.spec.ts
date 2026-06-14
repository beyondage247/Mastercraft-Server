import { Role } from '@prisma/client';
import * as XLSX from 'xlsx';
import { InventoryService } from './inventory.service';

function buildWorkbook(rows: unknown[][]) {
  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Inventory');
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

describe('InventoryService', () => {
  const staffUser = {
    id: 'staff-1',
    role: Role.STAFF,
    isAdmin: false,
  };

  const clientUser = {
    id: 'client-1',
    role: Role.CLIENT,
    isAdmin: false,
  };

  const prisma = {
    inventoryItem: {
      findMany: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  let service: InventoryService;

  beforeEach(() => {
    prisma.inventoryItem.findMany.mockReset();
    prisma.inventoryItem.createMany.mockReset();
    prisma.inventoryItem.update.mockReset();
    prisma.$transaction.mockReset();
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback({
        inventoryItem: {
          createMany: prisma.inventoryItem.createMany,
          update: prisma.inventoryItem.update,
        },
      }),
    );

    service = new InventoryService(prisma as any);
  });

  it('lists inventory items for non-admin staff users', async () => {
    prisma.inventoryItem.findMany.mockResolvedValue([
      {
        id: 'item-1',
        productName: 'Back Bands - 118-BB',
        productNameKey: 'back bands - 118-bb',
        itemCode: '118-BB',
        category: 'Back Bands',
        subcategory: 'Standard',
        material: 'Poplar',
        sizeDimension: '1-1/8" x 1-1/8"',
        unitMeasure: 'Each',
        supplier: 'Mastercraft',
        availabilityStatuses: ['IN_STOCK'],
        minReserve: 5,
        inStock: 2,
        notes: 'Stored on rack B3',
        active: true,
        lastPriceUpdate: new Date('2026-06-01T00:00:00.000Z'),
        createdAt: new Date('2026-06-01T00:00:00.000Z'),
        updatedAt: new Date('2026-06-02T00:00:00.000Z'),
      },
    ]);

    const result = await service.getInventoryList({} as any, staffUser);

    expect(prisma.inventoryItem.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: [{ category: 'asc' }, { productName: 'asc' }],
      select: expect.any(Object),
    });
    expect(result).toEqual([
      expect.objectContaining({
        id: 'item-1',
        name: 'Back Bands - 118-BB',
        sku: '118-BB',
        lowStock: true,
      }),
    ]);
  });

  it('imports inventory rows with a title row, updates matches, and skips divider rows', async () => {
    prisma.inventoryItem.findMany.mockResolvedValue([
      {
        id: 'item-1',
        itemCode: 'EX-1',
        productNameKey: 'existing item',
      },
    ]);
    prisma.inventoryItem.createMany.mockResolvedValue({ count: 1 });
    prisma.inventoryItem.update.mockResolvedValue({ id: 'item-1' });

    const buffer = buildWorkbook([
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
      ['  BACK BANDS'],
      [
        'Back Bands - 118-BB',
        '118-BB',
        'Back Bands',
        '',
        'Poplar',
        '1-1/8" x 1-1/8"',
        'Each',
        'Mastercraft',
        'In Stock',
        '5',
        '2',
        'Stored on rack B3',
        'Yes',
        '2026-06-01T00:00:00.000Z',
      ],
      [
        'Existing Item',
        'EX-1',
        'Back Bands',
        '',
        'Poplar',
        '1-1/2" x 1-1/2"',
        'Each',
        'Mastercraft',
        'Special Order',
        '3',
        '1',
        '',
        'Yes',
        '',
      ],
      [
        'Broken Item',
        'BAD-1',
        'Back Bands',
        '',
        'Poplar',
        '1-1/2" x 1-1/2"',
        'Each',
        'Mastercraft',
        'Backordered',
        '3',
        '1',
        '',
        'Yes',
        '',
      ],
    ]);

    const result = await service.importInventoryItems(
      {
        originalname: 'inventory.xlsx',
        buffer: Buffer.from(buffer),
      },
      staffUser,
    );

    expect(prisma.inventoryItem.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          productName: 'Back Bands - 118-BB',
          productNameKey: 'back bands - 118-bb',
          itemCode: '118-BB',
          category: 'Back Bands',
          material: 'Poplar',
          minReserve: 5,
          inStock: 2,
          notes: 'Stored on rack B3',
          availabilityStatuses: ['IN_STOCK'],
        }),
      ],
    });
    expect(prisma.inventoryItem.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: expect.objectContaining({
        productName: 'Existing Item',
        itemCode: 'EX-1',
        minReserve: 3,
        inStock: 1,
        availabilityStatuses: ['SPECIAL_ORDER'],
      }),
    });
    expect(result).toMatchObject({
      processedCount: 4,
      createdCount: 1,
      updatedCount: 1,
      skippedCount: 1,
      errorCount: 1,
    });
    expect(result.skippedRows).toEqual([
      expect.objectContaining({ row: 3, reason: 'Category divider row' }),
    ]);
    expect(result.errors).toEqual([
      expect.objectContaining({
        row: 6,
        reason: 'Invalid availabilityStatus value: Backordered',
      }),
    ]);
  });

  it('rejects client users from managing inventory', async () => {
    await expect(service.getInventorySummary(clientUser)).rejects.toThrow(
      'Only staff users can manage inventory',
    );
  });
});
