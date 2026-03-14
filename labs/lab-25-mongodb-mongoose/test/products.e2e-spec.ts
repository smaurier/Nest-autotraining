import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { MongooseModule } from '@nestjs/mongoose';
import { ProductsModule } from '../src/products/products.module';

describe('Products MongoDB CRUD (e2e)', () => {
  let app: INestApplication;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    const uri = mongod.getUri();

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        MongooseModule.forRoot(uri),
        ProductsModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  }, 30000);

  afterAll(async () => {
    if (app) await app.close();
    if (mongod) await mongod.stop();
  });

  let createdId: string;

  it('POST /products - should create a product', async () => {
    const dto = {
      name: 'Laptop Pro',
      description: 'A powerful laptop',
      price: 1299.99,
      category: 'Electronics',
      inStock: true,
      tags: ['laptop', 'pro'],
    };

    const res = await request(app.getHttpServer())
      .post('/products')
      .send(dto)
      .expect(201);

    expect(res.body).toMatchObject({
      name: 'Laptop Pro',
      description: 'A powerful laptop',
      price: 1299.99,
      category: 'Electronics',
      inStock: true,
      tags: ['laptop', 'pro'],
    });
    expect(res.body._id).toBeDefined();
    createdId = res.body._id;
  });

  it('POST /products - should create a second product', async () => {
    const dto = {
      name: 'Wireless Mouse',
      description: 'Ergonomic wireless mouse',
      price: 29.99,
      category: 'Accessories',
      inStock: true,
      tags: ['mouse', 'wireless'],
    };

    const res = await request(app.getHttpServer())
      .post('/products')
      .send(dto)
      .expect(201);

    expect(res.body.name).toBe('Wireless Mouse');
  });

  it('POST /products - should create a third product in same category', async () => {
    const dto = {
      name: 'Smartphone X',
      description: 'Latest smartphone model',
      price: 899.99,
      category: 'Electronics',
      inStock: false,
      tags: ['phone'],
    };

    const res = await request(app.getHttpServer())
      .post('/products')
      .send(dto)
      .expect(201);

    expect(res.body.name).toBe('Smartphone X');
    expect(res.body.inStock).toBe(false);
  });

  it('GET /products - should return all products', async () => {
    const res = await request(app.getHttpServer())
      .get('/products')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(3);
  });

  it('GET /products/:id - should return a single product', async () => {
    const res = await request(app.getHttpServer())
      .get(`/products/${createdId}`)
      .expect(200);

    expect(res.body._id).toBe(createdId);
    expect(res.body.name).toBe('Laptop Pro');
  });

  it('GET /products/:id - should return 404 for non-existent id', async () => {
    const fakeId = '65a1b2c3d4e5f6a7b8c9d0e1';
    await request(app.getHttpServer())
      .get(`/products/${fakeId}`)
      .expect(404);
  });

  it('PATCH /products/:id - should update a product', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/products/${createdId}`)
      .send({ price: 1199.99, name: 'Laptop Pro V2' })
      .expect(200);

    expect(res.body.price).toBe(1199.99);
    expect(res.body.name).toBe('Laptop Pro V2');
  });

  it('PATCH /products/:id - should return 404 for non-existent id', async () => {
    const fakeId = '65a1b2c3d4e5f6a7b8c9d0e1';
    await request(app.getHttpServer())
      .patch(`/products/${fakeId}`)
      .send({ price: 100 })
      .expect(404);
  });

  it('GET /products/search?q=term - should search products by name', async () => {
    const res = await request(app.getHttpServer())
      .get('/products/search?q=laptop')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('Laptop Pro V2');
  });

  it('GET /products/search?q=term - should search products by description', async () => {
    const res = await request(app.getHttpServer())
      .get('/products/search?q=ergonomic')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(1);
    expect(res.body[0].name).toBe('Wireless Mouse');
  });

  it('GET /products/search?q=term - should return empty for no match', async () => {
    const res = await request(app.getHttpServer())
      .get('/products/search?q=nonexistent')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(0);
  });

  it('GET /products/stats/by-category - should return stats grouped by category', async () => {
    const res = await request(app.getHttpServer())
      .get('/products/stats/by-category')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBe(2);

    const accessories = res.body.find((s: any) => s._id === 'Accessories');
    expect(accessories).toBeDefined();
    expect(accessories.count).toBe(1);
    expect(accessories.avgPrice).toBeCloseTo(29.99);

    const electronics = res.body.find((s: any) => s._id === 'Electronics');
    expect(electronics).toBeDefined();
    expect(electronics.count).toBe(2);
    expect(electronics.avgPrice).toBeCloseTo((1199.99 + 899.99) / 2);
  });

  it('DELETE /products/:id - should delete a product', async () => {
    await request(app.getHttpServer())
      .delete(`/products/${createdId}`)
      .expect(200);

    // Verify it's gone
    await request(app.getHttpServer())
      .get(`/products/${createdId}`)
      .expect(404);
  });

  it('DELETE /products/:id - should return 404 for non-existent id', async () => {
    const fakeId = '65a1b2c3d4e5f6a7b8c9d0e1';
    await request(app.getHttpServer())
      .delete(`/products/${fakeId}`)
      .expect(404);
  });
});
