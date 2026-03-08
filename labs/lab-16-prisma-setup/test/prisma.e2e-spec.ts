import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Prisma Setup (e2e)', () => {
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
    await prisma['product'].deleteMany();
    await prisma['category'].deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('Categories', () => {
    it('POST /categories — should create a category', async () => {
      const res = await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Electronics', description: 'Electronic devices' })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'Electronics',
        description: 'Electronic devices',
      });
      expect(res.body.id).toBeDefined();
    });

    it('GET /categories — should return all categories', async () => {
      await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Books' });
      await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Music' });

      const res = await request(app.getHttpServer())
        .get('/categories')
        .expect(200);

      expect(res.body).toHaveLength(2);
    });

    it('GET /categories/:id — should return a category with its products', async () => {
      const catRes = await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Clothing' });

      await request(app.getHttpServer())
        .post('/products')
        .send({
          name: 'T-Shirt',
          price: 19.99,
          categoryId: catRes.body.id,
        });

      const res = await request(app.getHttpServer())
        .get(`/categories/${catRes.body.id}`)
        .expect(200);

      expect(res.body.name).toBe('Clothing');
      expect(res.body.products).toHaveLength(1);
      expect(res.body.products[0].name).toBe('T-Shirt');
    });

    it('DELETE /categories/:id — should delete a category', async () => {
      const catRes = await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'ToDelete' });

      await request(app.getHttpServer())
        .delete(`/categories/${catRes.body.id}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/categories')
        .expect(200);

      expect(res.body).toHaveLength(0);
    });
  });

  describe('Products', () => {
    it('POST /products — should create a product with a category', async () => {
      const catRes = await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Electronics' });

      const res = await request(app.getHttpServer())
        .post('/products')
        .send({
          name: 'Laptop',
          description: 'A powerful laptop',
          price: 999.99,
          stock: 10,
          categoryId: catRes.body.id,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        name: 'Laptop',
        price: 999.99,
        stock: 10,
      });
      expect(res.body.id).toBeDefined();
    });

    it('GET /products — should return products with category included', async () => {
      const catRes = await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Food' });

      await request(app.getHttpServer())
        .post('/products')
        .send({
          name: 'Apple',
          price: 1.5,
          categoryId: catRes.body.id,
        });

      const res = await request(app.getHttpServer())
        .get('/products')
        .expect(200);

      expect(res.body).toHaveLength(1);
      expect(res.body[0].category).toBeDefined();
      expect(res.body[0].category.name).toBe('Food');
    });

    it('GET /products/:id — should return a single product with category', async () => {
      const catRes = await request(app.getHttpServer())
        .post('/categories')
        .send({ name: 'Tools' });

      const prodRes = await request(app.getHttpServer())
        .post('/products')
        .send({
          name: 'Hammer',
          price: 15.0,
          categoryId: catRes.body.id,
        });

      const res = await request(app.getHttpServer())
        .get(`/products/${prodRes.body.id}`)
        .expect(200);

      expect(res.body.name).toBe('Hammer');
      expect(res.body.category).toBeDefined();
      expect(res.body.category.name).toBe('Tools');
    });

    it('PATCH /products/:id — should update a product', async () => {
      const prodRes = await request(app.getHttpServer())
        .post('/products')
        .send({ name: 'Old Name', price: 10 });

      const res = await request(app.getHttpServer())
        .patch(`/products/${prodRes.body.id}`)
        .send({ name: 'New Name', price: 20 })
        .expect(200);

      expect(res.body.name).toBe('New Name');
      expect(res.body.price).toBe(20);
    });

    it('DELETE /products/:id — should remove a product', async () => {
      const prodRes = await request(app.getHttpServer())
        .post('/products')
        .send({ name: 'ToDelete', price: 5 });

      await request(app.getHttpServer())
        .delete(`/products/${prodRes.body.id}`)
        .expect(200);

      const res = await request(app.getHttpServer())
        .get('/products')
        .expect(200);

      expect(res.body).toHaveLength(0);
    });

    it('GET /products/:id — should return 404 for non-existent product', async () => {
      await request(app.getHttpServer())
        .get('/products/99999')
        .expect(404);
    });
  });
});
