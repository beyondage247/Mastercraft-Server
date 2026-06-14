import { ValidationPipe, INestApplication } from '@nestjs/common';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma, Role } from '@prisma/client';
import * as request from 'supertest';
import * as XLSX from 'xlsx';
import { App } from 'supertest/types';
import { ServicesController } from '../src/modules/services/services.controller';
import { ServicesService } from '../src/modules/services/services.service';
import { AuthGuard } from '../src/modules/auth/guards/auth.guard';
import { RolesGuard } from '../src/modules/auth/guards/roles.guard';
import { PrismaService } from '../src/services/prisma/prisma.service';

function buildWorkbook(rows: Record<string, unknown>[]) {
  const worksheet = XLSX.utils.json_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Catalog');
  return Buffer.from(XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' }));
}

function buildCatalogItem(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: '8f1e52bc-5a3c-4f5b-8f80-51f0b4649224',
    productName: 'Door A',
    productNameKey: 'door a',
    itemCode: 'KD-111',
    subcategory: 'Raised Panel',
    supplierCost: new Prisma.Decimal('219'),
    ourPrice: new Prisma.Decimal('306.6'),
    markUp: new Prisma.Decimal('40'),
    availabilityStatuses: ['IN_STOCK'],
    category: 'Interior Doors',
    supplier: 'Koch Doors',
    sizeDimension: `1'0 up to 1'5`,
    unitMeasure: 'Each',
    styleProfile: '8728 - V-GROOVE',
    supplierCatalogue: '111',
    active: true,
    lastPriceUpdate: new Date('2026-05-24T00:00:00.000Z'),
    createdAt: new Date('2026-05-24T10:30:00.000Z'),
    updatedAt: new Date('2026-05-24T10:35:00.000Z'),
    ...overrides,
  };
}

describe('ServicesController (e2e)', () => {
  let app: INestApplication<App>;
  let jwtService: JwtService;
  let httpApp: unknown;

  const prisma = {
    catalogItem: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      createMany: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-secret';
    process.env.JWT_EXPIRES_IN = '1h';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          global: true,
          secret: process.env.JWT_SECRET,
          signOptions: { expiresIn: process.env.JWT_EXPIRES_IN as any },
        }),
      ],
      controllers: [ServicesController],
      providers: [
        ServicesService,
        AuthGuard,
        RolesGuard,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
    httpApp = app.getHttpAdapter().getInstance();

    jwtService = moduleFixture.get(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await app.close();
  });

  async function signToken(role: Role) {
    return jwtService.signAsync({
      id: 'user-1',
      role,
      isAdmin: role === Role.STAFF,
    });
  }

  it('rejects client access to staff-only routes', async () => {
    const token = await signToken(Role.CLIENT);

    await request(httpApp as any)
      .get('/services')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });

  it('lists catalog items with normalized response values', async () => {
    prisma.catalogItem.findMany.mockResolvedValue([buildCatalogItem()]);
    const token = await signToken(Role.STAFF);

    await request(httpApp as any)
      .get('/services')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual([
          expect.objectContaining({
            id: '8f1e52bc-5a3c-4f5b-8f80-51f0b4649224',
            supplierCost: '219',
            ourPrice: '306.6',
            markUp: '40',
            availabilityStatus: ['IN_STOCK'],
            active: true,
          }),
        ]);
      });
  });

  it('gets one catalog item with normalized response values', async () => {
    prisma.catalogItem.findUnique.mockResolvedValue(buildCatalogItem());
    const token = await signToken(Role.STAFF);

    await request(httpApp as any)
      .get('/services/8f1e52bc-5a3c-4f5b-8f80-51f0b4649224')
      .set('Authorization', `Bearer ${token}`)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual(
          expect.objectContaining({
            id: '8f1e52bc-5a3c-4f5b-8f80-51f0b4649224',
            productName: 'Door A',
            availabilityStatus: ['IN_STOCK'],
            lastPriceUpdate: '2026-05-24T00:00:00.000Z',
          }),
        );
      });
  });

  it('imports a valid workbook and creates new rows', async () => {
    prisma.catalogItem.findMany.mockResolvedValue([]);
    prisma.catalogItem.createMany.mockResolvedValue({ count: 1 });
    const token = await signToken(Role.STAFF);

    await request(httpApp as any)
      .post('/services/import')
      .set('Authorization', `Bearer ${token}`)
      .attach(
        'file',
        buildWorkbook([
          {
            productName: 'Door A',
            itemCode: 'KD-111',
            category: 'Interior Doors',
            supplier: 'Koch Doors',
            availabilityStatus: 'In Stock',
            active: 'Yes',
          },
        ]),
        'catalog.xlsx',
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          importedCount: 1,
          skippedCount: 0,
          errorCount: 0,
        });
      });
  });

  it('skips duplicate rows during import', async () => {
    prisma.catalogItem.findMany.mockResolvedValue([
      { itemCode: 'KD-111', productNameKey: 'door a' },
    ]);
    prisma.catalogItem.createMany.mockResolvedValue({ count: 1 });
    const token = await signToken(Role.STAFF);

    await request(httpApp as any)
      .post('/services/import')
      .set('Authorization', `Bearer ${token}`)
      .attach(
        'file',
        buildWorkbook([
          {
            productName: 'Door A',
            itemCode: 'KD-111',
            category: 'Interior Doors',
            supplier: 'Koch Doors',
            availabilityStatus: 'In Stock',
            active: 'Yes',
          },
          {
            productName: 'Door B',
            itemCode: 'KD-222',
            category: 'Interior Doors',
            supplier: 'Koch Doors',
            availabilityStatus: 'Special Order',
            active: 'Yes',
          },
        ]),
        'catalog.xlsx',
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body.importedCount).toBe(1);
        expect(body.skippedRows).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ reason: 'Duplicate itemCode: KD-111' }),
          ]),
        );
      });
  });

  it('reports malformed rows without aborting valid ones', async () => {
    prisma.catalogItem.findMany.mockResolvedValue([]);
    prisma.catalogItem.createMany.mockResolvedValue({ count: 1 });
    const token = await signToken(Role.STAFF);

    await request(httpApp as any)
      .post('/services/import')
      .set('Authorization', `Bearer ${token}`)
      .attach(
        'file',
        buildWorkbook([
          {
            productName: '',
            itemCode: 'KD-111',
            category: 'Interior Doors',
            supplier: 'Koch Doors',
            availabilityStatus: 'In Stock',
            active: 'Yes',
          },
          {
            productName: 'Door B',
            itemCode: 'KD-222',
            category: 'Interior Doors',
            supplier: 'Koch Doors',
            availabilityStatus: 'In Stock',
            active: 'Yes',
          },
        ]),
        'catalog.xlsx',
      )
      .expect(200)
      .expect(({ body }) => {
        expect(body.importedCount).toBe(1);
        expect(body.errorCount).toBe(1);
        expect(body.errors).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ reason: 'productName is required' }),
          ]),
        );
      });
  });

  it('updates a catalog item', async () => {
    prisma.catalogItem.findUnique.mockResolvedValueOnce({
      id: '8f1e52bc-5a3c-4f5b-8f80-51f0b4649224',
      itemCode: 'KD-111',
      productNameKey: 'door a',
    });
    prisma.catalogItem.update.mockResolvedValue(
      buildCatalogItem({
        ourPrice: new Prisma.Decimal('320.4'),
        updatedAt: new Date('2026-05-25T08:00:00.000Z'),
      }),
    );
    const token = await signToken(Role.STAFF);

    await request(httpApp as any)
      .patch('/services/8f1e52bc-5a3c-4f5b-8f80-51f0b4649224')
      .set('Authorization', `Bearer ${token}`)
      .send({ ourPrice: '320.4' })
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          message: 'Catalog item updated successfully',
          item: expect.objectContaining({
            ourPrice: '320.4',
          }),
        });
      });
  });

  it('rejects update uniqueness conflicts', async () => {
    prisma.catalogItem.findUnique.mockResolvedValueOnce({
      id: '8f1e52bc-5a3c-4f5b-8f80-51f0b4649224',
      itemCode: 'KD-111',
      productNameKey: 'door a',
    });
    prisma.catalogItem.findFirst.mockResolvedValue({ id: 'other-item' });
    const token = await signToken(Role.STAFF);

    await request(httpApp as any)
      .patch('/services/8f1e52bc-5a3c-4f5b-8f80-51f0b4649224')
      .set('Authorization', `Bearer ${token}`)
      .send({ itemCode: 'KD-999' })
      .expect(400)
      .expect(({ body }) => {
        expect(body.message).toBe('itemCode already exists');
      });
  });
});
