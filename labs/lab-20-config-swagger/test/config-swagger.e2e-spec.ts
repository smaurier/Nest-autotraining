import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from '../src/app.module';

describe('Config & Swagger (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));

    const config = new DocumentBuilder()
      .setTitle('Products API')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api', app, document);

    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Config', () => {
    it('should load config values correctly', async () => {
      // The app should start without config validation errors
      expect(app).toBeDefined();
    });
  });

  describe('Swagger', () => {
    it('GET /api-json should return OpenAPI spec', async () => {
      const response = await request(app.getHttpServer())
        .get('/api-json')
        .expect(200);

      expect(response.body).toBeDefined();
      expect(response.body.openapi).toBeDefined();
      expect(response.body.paths).toBeDefined();
    });
  });

  describe('Products CRUD', () => {
    it('POST /products should create a product', async () => {
      const response = await request(app.getHttpServer())
        .post('/products')
        .send({ name: 'Widget', description: 'A nice widget', price: 9.99 })
        .expect(201);

      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe('Widget');
      expect(response.body.price).toBe(9.99);
    });

    it('GET /products should return all products', async () => {
      await request(app.getHttpServer())
        .post('/products')
        .send({ name: 'Widget', description: 'A nice widget', price: 9.99 });

      const response = await request(app.getHttpServer())
        .get('/products')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body).toHaveLength(1);
    });

    it('GET /products/:id should return a product', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/products')
        .send({ name: 'Widget', description: 'A nice widget', price: 9.99 });

      const response = await request(app.getHttpServer())
        .get(`/products/${createRes.body.id}`)
        .expect(200);

      expect(response.body.name).toBe('Widget');
    });

    it('GET /products/:id should return 404 for non-existent', async () => {
      await request(app.getHttpServer())
        .get('/products/999')
        .expect(404);
    });

    it('PATCH /products/:id should update a product', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/products')
        .send({ name: 'Widget', description: 'A nice widget', price: 9.99 });

      const response = await request(app.getHttpServer())
        .patch(`/products/${createRes.body.id}`)
        .send({ price: 19.99 })
        .expect(200);

      expect(response.body.price).toBe(19.99);
      expect(response.body.name).toBe('Widget');
    });

    it('DELETE /products/:id should remove a product', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/products')
        .send({ name: 'Widget', description: 'A nice widget', price: 9.99 });

      await request(app.getHttpServer())
        .delete(`/products/${createRes.body.id}`)
        .expect(200);

      await request(app.getHttpServer())
        .get(`/products/${createRes.body.id}`)
        .expect(404);
    });
  });
});
