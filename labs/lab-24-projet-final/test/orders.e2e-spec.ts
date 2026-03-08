import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Orders (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let userToken: string;
  let userId: number;

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

    const bcrypt = require('bcryptjs');

    // Create admin
    const adminHash = await bcrypt.hash('admin123', 10);
    await prisma['user'].create({
      data: {
        email: 'admin@test.com',
        password: adminHash,
        name: 'Admin',
        role: 'admin',
      },
    });
    const adminLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'admin@test.com', password: 'admin123' });
    adminToken = adminLogin.body.access_token;

    // Create customer
    const registerRes = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        email: 'customer@test.com',
        password: 'customer123',
        name: 'Customer',
      });
    userId = registerRes.body.id;

    const userLogin = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'customer@test.com', password: 'customer123' });
    userToken = userLogin.body.access_token;
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /orders', () => {
    it('should create an order with items', async () => {
      // Create products
      const prod1 = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Widget', price: 25, stock: 100 });

      const prod2 = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Gadget', price: 50, stock: 50 });

      const res = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [
            { productId: prod1.body.id, quantity: 2 },
            { productId: prod2.body.id, quantity: 1 },
          ],
        })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.status).toBe('pending');
      expect(res.body.total).toBeGreaterThan(0);
      expect(res.body.items).toHaveLength(2);
    });

    it('should reject order without auth', async () => {
      await request(app.getHttpServer())
        .post('/orders')
        .send({ items: [{ productId: 1, quantity: 1 }] })
        .expect(401);
    });
  });

  describe('GET /orders', () => {
    it('should return user orders', async () => {
      const prod = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Item', price: 30, stock: 10 });

      await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ productId: prod.body.id, quantity: 1 }],
        });

      const res = await request(app.getHttpServer())
        .get('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].items).toBeDefined();
    });
  });

  describe('GET /orders/:id', () => {
    it('should return a single order with details', async () => {
      const prod = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Detail Item', price: 45, stock: 20 });

      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ productId: prod.body.id, quantity: 3 }],
        });

      const res = await request(app.getHttpServer())
        .get(`/orders/${orderRes.body.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(res.body.id).toBe(orderRes.body.id);
      expect(res.body.items).toHaveLength(1);
      expect(res.body.items[0].product).toBeDefined();
    });
  });

  describe('PATCH /orders/:id/status', () => {
    it('should update order status (admin)', async () => {
      const prod = await request(app.getHttpServer())
        .post('/products')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ name: 'Status Item', price: 20, stock: 5 });

      const orderRes = await request(app.getHttpServer())
        .post('/orders')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          items: [{ productId: prod.body.id, quantity: 1 }],
        });

      const res = await request(app.getHttpServer())
        .patch(`/orders/${orderRes.body.id}/status`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'shipped' })
        .expect(200);

      expect(res.body.status).toBe('shipped');
    });
  });
});
