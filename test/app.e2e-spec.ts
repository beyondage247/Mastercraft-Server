import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { setupSwagger } from './../src/setup-swagger';

describe('AppController (e2e)', () => {
  let app: INestApplication<App>;
  let httpApp: unknown;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    setupSwagger(app);
    await app.init();
    httpApp = app.getHttpAdapter().getInstance();
  });

  it('/ (GET)', () => {
    return request(httpApp as any)
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/docs-json (GET)', () => {
    return request(httpApp as any)
      .get('/docs-json')
      .expect(200)
      .expect(({ body }) => {
        expect(body.openapi).toBeDefined();
        expect(body.paths['/']).toBeDefined();
      });
  });
});
