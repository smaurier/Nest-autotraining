import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Pipes, Guards & Interceptors (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('ParsePositiveIntPipe', () => {
    it('should reject negative ids', async () => {
      await request(app.getHttpServer())
        .get('/items/-1')
        .expect(400);
    });

    it('should reject non-numeric ids', async () => {
      await request(app.getHttpServer())
        .get('/items/abc')
        .expect(400);
    });

    it('should reject zero', async () => {
      await request(app.getHttpServer())
        .get('/items/0')
        .expect(400);
    });
  });

  describe('AuthGuard', () => {
    it('POST /items — should reject without Authorization header', async () => {
      await request(app.getHttpServer())
        .post('/items')
        .send({ name: 'Test Item' })
        .expect(401);
    });

    it('POST /items — should reject with invalid token', async () => {
      await request(app.getHttpServer())
        .post('/items')
        .set('Authorization', 'Bearer invalid-token')
        .send({ name: 'Test Item' })
        .expect(401);
    });

    it('POST /items — should accept with valid user token', async () => {
      const res = await request(app.getHttpServer())
        .post('/items')
        .set('Authorization', 'Bearer user-token')
        .send({ name: 'Test Item', description: 'A test item' })
        .expect(201);

      expect(res.body).toHaveProperty('data');
      expect(res.body.data).toHaveProperty('id');
      expect(res.body.data.name).toBe('Test Item');
    });
  });

  describe('RolesGuard', () => {
    let itemId: number;

    beforeAll(async () => {
      const res = await request(app.getHttpServer())
        .post('/items')
        .set('Authorization', 'Bearer admin-token')
        .send({ name: 'Item to delete' });
      itemId = res.body.data.id;
    });

    it('DELETE /items/:id — should reject non-admin users', async () => {
      await request(app.getHttpServer())
        .delete(`/items/${itemId}`)
        .set('Authorization', 'Bearer user-token')
        .expect(403);
    });

    it('DELETE /items/:id — should accept admin users', async () => {
      await request(app.getHttpServer())
        .delete(`/items/${itemId}`)
        .set('Authorization', 'Bearer admin-token')
        .expect(200);
    });
  });

  describe('TransformInterceptor', () => {
    it('GET /items — should wrap response in { data: [...] }', async () => {
      const res = await request(app.getHttpServer())
        .get('/items')
        .expect(200);

      expect(res.body).toHaveProperty('data');
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('CRUD with guards', () => {
    let createdId: number;

    it('POST /items — should create an item with admin token', async () => {
      const res = await request(app.getHttpServer())
        .post('/items')
        .set('Authorization', 'Bearer admin-token')
        .send({ name: 'Admin Item', description: 'Created by admin' })
        .expect(201);

      expect(res.body.data.name).toBe('Admin Item');
      createdId = res.body.data.id;
    });

    it('GET /items/:id — should get the item', async () => {
      const res = await request(app.getHttpServer())
        .get(`/items/${createdId}`)
        .expect(200);

      expect(res.body.data.name).toBe('Admin Item');
    });

    it('PATCH /items/:id — should update with valid token', async () => {
      const res = await request(app.getHttpServer())
        .patch(`/items/${createdId}`)
        .set('Authorization', 'Bearer user-token')
        .send({ name: 'Updated Item' })
        .expect(200);

      expect(res.body.data.name).toBe('Updated Item');
    });

    it('GET /items/:id — should return 404 for non-existent item', async () => {
      const res = await request(app.getHttpServer())
        .get('/items/99999')
        .expect(404);

      expect(res.body).toHaveProperty('statusCode', 404);
      expect(res.body).toHaveProperty('path');
      expect(res.body).toHaveProperty('timestamp');
    });
  });
});
