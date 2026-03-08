import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Prisma Advanced (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    prisma = app.get(PrismaService);
    await app.init();
  });

  beforeEach(async () => {
    // Clean up database before each test
    await prisma['orderItem'].deleteMany();
    await prisma['order'].deleteMany();
    await prisma['product'].deleteMany();
    await prisma['category'].deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Cursor Pagination', () => {
    it('GET /products — should return paginated results', async () => {
      // Seed 15 products
      for (let i = 1; i <= 15; i++) {
        await request(app.getHttpServer())
          .post('/products')
          .send({ name: `Product ${i}`, price: i * 10 });
      }

      // First page (take 5)
      const page1 = await request(app.getHttpServer())
        .get('/products?take=5')
        .expect(200);

      expect(page1.body.data).toHaveLength(5);
      expect(page1.body.nextCursor).toBeDefined();
      expect(page1.body.nextCursor).not.toBeNull();

      // Second page using cursor
      const page2 = await request(app.getHttpServer())
        .get(`/products?cursor=${page1.body.nextCursor}&take=5`)
        .expect(200);

      expect(page2.body.data).toHaveLength(5);
      expect(page2.body.data[0].id).toBeGreaterThan(page1.body.nextCursor);
    });

    it('GET /products — should return null nextCursor on last page', async () => {
      // Seed 3 products
      for (let i = 1; i <= 3; i++) {
        await request(app.getHttpServer())
          .post('/products')
          .send({ name: `Product ${i}`, price: i * 10 });
      }

      const res = await request(app.getHttpServer())
        .get('/products?take=10')
        .expect(200);

      expect(res.body.data).toHaveLength(3);
      expect(res.body.nextCursor).toBeNull();
    });
  });

  describe('Soft Delete', () => {
    it('DELETE /products/:id — should soft delete a product', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/products')
        .send({ name: 'ToSoftDelete', price: 99 });

      await request(app.getHttpServer())
        .delete(`/products/${createRes.body.id}`)
        .expect(200);

      // Verify the product no longer appears in listing (soft delete middleware filters it)
      const listRes = await request(app.getHttpServer())
        .get('/products')
        .expect(200);

      const found = listRes.body.data.find(
        (p: any) => p.id === createRes.body.id,
      );
      expect(found).toBeUndefined();
    });

    it('DELETE /products/:id — soft deleted product should still exist in DB', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/products')
        .send({ name: 'StillInDB', price: 50 });

      await request(app.getHttpServer())
        .delete(`/products/${createRes.body.id}`)
        .expect(200);

      // Query directly via Prisma bypassing middleware to confirm it exists
      const product = await prisma['product'].findUnique({
        where: { id: createRes.body.id, deletedAt: { not: null } },
      });
      expect(product).toBeDefined();
      expect(product.deletedAt).not.toBeNull();
    });
  });

  describe('Nested Writes (Orders)', () => {
    it('POST /orders — should create order with nested items', async () => {
      // Create products first
      const prod1 = await request(app.getHttpServer())
        .post('/products')
        .send({ name: 'Keyboard', price: 75, stock: 20 });
      const prod2 = await request(app.getHttpServer())
        .post('/products')
        .send({ name: 'Mouse', price: 25, stock: 50 });

      const res = await request(app.getHttpServer())
        .post('/orders')
        .send({
          items: [
            { productId: prod1.body.id, quantity: 2, price: 75 },
            { productId: prod2.body.id, quantity: 1, price: 25 },
          ],
        })
        .expect(201);

      expect(res.body.total).toBe(175); // 2*75 + 1*25
      expect(res.body.items).toHaveLength(2);
      expect(res.body.items[0].product).toBeDefined();
      expect(res.body.status).toBe('pending');
    });

    it('GET /orders — should return orders with items and products', async () => {
      const prod = await request(app.getHttpServer())
        .post('/products')
        .send({ name: 'Monitor', price: 300, stock: 5 });

      await request(app.getHttpServer())
        .post('/orders')
        .send({
          items: [{ productId: prod.body.id, quantity: 1, price: 300 }],
        });

      const res = await request(app.getHttpServer())
        .get('/orders')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].items).toHaveLength(1);
      expect(res.body[0].items[0].product).toBeDefined();
      expect(res.body[0].items[0].product.name).toBe('Monitor');
    });
  });

  describe('Interactive Transactions (Cancel Order)', () => {
    it('PATCH /orders/:id/cancel — should cancel a pending order', async () => {
      const prod = await request(app.getHttpServer())
        .post('/products')
        .send({ name: 'Tablet', price: 500, stock: 10 });

      const order = await request(app.getHttpServer())
        .post('/orders')
        .send({
          items: [{ productId: prod.body.id, quantity: 1, price: 500 }],
        });

      const res = await request(app.getHttpServer())
        .patch(`/orders/${order.body.id}/cancel`)
        .expect(200);

      expect(res.body.status).toBe('cancelled');
    });

    it('PATCH /orders/:id/cancel — should reject cancelling already cancelled order', async () => {
      const prod = await request(app.getHttpServer())
        .post('/products')
        .send({ name: 'Phone', price: 800, stock: 5 });

      const order = await request(app.getHttpServer())
        .post('/orders')
        .send({
          items: [{ productId: prod.body.id, quantity: 1, price: 800 }],
        });

      // Cancel once
      await request(app.getHttpServer())
        .patch(`/orders/${order.body.id}/cancel`)
        .expect(200);

      // Try to cancel again
      await request(app.getHttpServer())
        .patch(`/orders/${order.body.id}/cancel`)
        .expect(400);
    });
  });
});
