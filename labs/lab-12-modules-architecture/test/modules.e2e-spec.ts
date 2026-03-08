import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { LoggerService } from '../src/shared/logger.service';
import { DateService } from '../src/shared/date.service';
import { DATABASE_CONFIG } from '../src/database/database.module';

describe('Modules Architecture (e2e)', () => {
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

  describe('SharedModule', () => {
    it('should provide LoggerService', () => {
      const logger = app.get(LoggerService);
      expect(logger).toBeDefined();
      const result = logger.log('Test', 'hello');
      expect(result).toBe('[Test] hello');
    });

    it('should provide DateService', () => {
      const dateService = app.get(DateService);
      expect(dateService).toBeDefined();
      const now = dateService.now();
      expect(typeof now).toBe('string');
      expect(now).toMatch(/^\d{4}-\d{2}-\d{2}/);
    });

    it('DateService.format should return YYYY-MM-DD', () => {
      const dateService = app.get(DateService);
      const formatted = dateService.format(new Date('2024-06-15T12:00:00Z'));
      expect(formatted).toBe('2024-06-15');
    });
  });

  describe('DatabaseModule', () => {
    it('should provide database config via forRoot', () => {
      const config = app.get(DATABASE_CONFIG);
      expect(config).toBeDefined();
      expect(config.type).toBe('memory');
    });
  });

  describe('UsersModule', () => {
    it('POST /users — should create a user', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Alice', email: 'alice@example.com' })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Alice');
      expect(res.body.email).toBe('alice@example.com');
      expect(res.body).toHaveProperty('createdAt');
    });

    it('GET /users — should return all users', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('ProductsModule', () => {
    it('POST /products — should create a product', async () => {
      const res = await request(app.getHttpServer())
        .post('/products')
        .send({ name: 'Widget', price: 9.99 })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Widget');
      expect(res.body.price).toBe(9.99);
      expect(res.body).toHaveProperty('createdAt');
    });

    it('GET /products — should return all products', async () => {
      const res = await request(app.getHttpServer())
        .get('/products')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });
  });
});
