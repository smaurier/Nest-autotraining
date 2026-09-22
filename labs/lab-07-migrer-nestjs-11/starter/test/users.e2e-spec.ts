import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('UsersController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('POST /users should create a user', async () => {
    const response = await request(app.getHttpServer())
      .post('/users')
      .send({ name: 'John', email: 'john@test.com' })
      .expect(201);

    expect(response.body).toBeDefined();
    expect(response.body.id).toBeDefined();
    expect(response.body.name).toBe('John');
    expect(response.body.email).toBe('john@test.com');
  });

  it('GET /users should return all users', async () => {
    await request(app.getHttpServer())
      .post('/users')
      .send({ name: 'John', email: 'john@test.com' });

    const response = await request(app.getHttpServer())
      .get('/users')
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);
    expect(response.body[0].name).toBe('John');
  });

  it('GET /users/:id should return a single user', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/users')
      .send({ name: 'John', email: 'john@test.com' });

    const response = await request(app.getHttpServer())
      .get(`/users/${createRes.body.id}`)
      .expect(200);

    expect(response.body.name).toBe('John');
    expect(response.body.email).toBe('john@test.com');
  });

  it('GET /users/:id should return 404 for non-existent user', async () => {
    await request(app.getHttpServer())
      .get('/users/999')
      .expect(404);
  });

  it('PATCH /users/:id should update a user', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/users')
      .send({ name: 'John', email: 'john@test.com' });

    const response = await request(app.getHttpServer())
      .patch(`/users/${createRes.body.id}`)
      .send({ name: 'Jane' })
      .expect(200);

    expect(response.body.name).toBe('Jane');
    expect(response.body.email).toBe('john@test.com');
  });

  it('DELETE /users/:id should remove a user', async () => {
    const createRes = await request(app.getHttpServer())
      .post('/users')
      .send({ name: 'John', email: 'john@test.com' });

    await request(app.getHttpServer())
      .delete(`/users/${createRes.body.id}`)
      .expect(200);

    const response = await request(app.getHttpServer())
      .get('/users')
      .expect(200);

    expect(response.body).toHaveLength(0);
  });
});
