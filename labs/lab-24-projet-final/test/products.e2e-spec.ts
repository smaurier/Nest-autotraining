import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Products (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    prisma = app.get(PrismaService);
    await app.init();
  });

  beforeEach(async () => {
    // Clean up
    await prisma['cartItem'].deleteMany();
    await prisma['cart'].deleteMany();
    await prisma['orderItem'].deleteMany();
    await prisma['order'].deleteMany();
    await prisma['product'].deleteMany();
    await prisma['category'].deleteMany();
    await prisma['user'].deleteMany();

    // Create an admin user
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await prisma['user'].create({
      data: {
        email: 'admin@test.com',
        password: hashedPassword,
        name: 'Admin',
        role: 'admin',
      },
    });

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: 'admin123' });

    adminToken = loginRes.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /products', () => {
    it('should create a product (admin)', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Test Product',
          description: 'A test product',
          price: 29.99,
          stock: 100,
        })
        .expect(201);

      expect(res.body.name).toBe('Test Product');
      expect(res.body.price).toBe(29.99);
      expect(res.body.stock).toBe(100);
    });

    it('should reject creation without auth', async () => {
      await request(app.getHttpServer())
        .post('/products')
        .send({ name: 'No Auth', price: 10 })
        .expect(401);
    });
  });

  describe('GET /products', () => {
    it('should return all products (public)', async () => {
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Product A', price: 10 });

      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Product B', price: 20 });

      const res = await request(app.getHttpServer())
        .get('/products')
        .expect(200);

      expect(res.body).toHaveLength(2);
    });

    it('should search products by name', async () => {
      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Laptop Pro', price: 999 });

      await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Mouse Pad', price: 15 });

      const res = await request(app.getHttpServer())
        .get('/products?search=Laptop')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].name).toBe('Laptop Pro');
    });
  });

  describe('GET /products/:id', () => {
    it('should return a single product', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Single', price: 50 });

      const res = await request(app.getHttpServer())
        .get(`/products/${createRes.body.id}`)
        .expect(200);

      expect(res.body.name).toBe('Single');
    });

    it('should return 404 for non-existent product', async () => {
      await request(app.getHttpServer())
        .get('/products/99999')
        .expect(404);
    });
  });

  describe('PATCH /products/:id', () => {
    it('should update a product (admin)', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Old', price: 10 });

      const res = await request(app.getHttpServer())
        .patch(`/products/${createRes.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Updated', price: 25 })
        .expect(200);

      expect(res.body.name).toBe('Updated');
      expect(res.body.price).toBe(25);
    });
  });

  describe('DELETE /products/:id', () => {
    it('should delete a product (admin)', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'ToDelete', price: 5 });

      await request(app.getHttpServer())
        .delete(`/products/${createRes.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      const listRes = await request(app.getHttpServer())
        .get('/products')
        .expect(200);

      expect(listRes.body).toHaveLength(0);
    });
  });
});
