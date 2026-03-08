import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('AuthController (e2e)', () => {
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

  const testUser = { username: 'testuser', password: 'password123' };

  it('POST /auth/register should register a new user', async () => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser)
      .expect(201);

    expect(response.body).toBeDefined();
    expect(response.body.username).toBe('testuser');
    expect(response.body.password).toBeUndefined();
    expect(response.body.id).toBeDefined();
  });

  it('POST /auth/register should reject duplicate username', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser);

    await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser)
      .expect(409);
  });

  it('POST /auth/login should return tokens', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser);

    const response = await request(app.getHttpServer())
      .post('/auth/login')
      .send(testUser)
      .expect(201);

    expect(response.body.access_token).toBeDefined();
    expect(response.body.refresh_token).toBeDefined();
    expect(response.body.user).toBeDefined();
    expect(response.body.user.username).toBe('testuser');
  });

  it('POST /auth/login should reject invalid credentials', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser);

    await request(app.getHttpServer())
      .post('/auth/login')
      .send({ username: 'testuser', password: 'wrong' })
      .expect(401);
  });

  it('GET /auth/profile should return user with valid JWT', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send(testUser);

    const response = await request(app.getHttpServer())
      .get('/auth/profile')
      .set('Authorization', `Bearer ${loginRes.body.access_token}`)
      .expect(200);

    expect(response.body.username).toBe('testuser');
  });

  it('GET /auth/profile should reject without token', async () => {
    await request(app.getHttpServer())
      .get('/auth/profile')
      .expect(401);
  });

  it('POST /auth/refresh should return new tokens', async () => {
    await request(app.getHttpServer())
      .post('/auth/register')
      .send(testUser);

    const loginRes = await request(app.getHttpServer())
      .post('/auth/login')
      .send(testUser);

    const response = await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: loginRes.body.refresh_token })
      .expect(201);

    expect(response.body.access_token).toBeDefined();
    expect(response.body.refresh_token).toBeDefined();
  });

  it('POST /auth/refresh should reject invalid token', async () => {
    await request(app.getHttpServer())
      .post('/auth/refresh')
      .send({ refresh_token: 'invalid-token' })
      .expect(401);
  });
});
