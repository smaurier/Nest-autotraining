import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Articles CRUD (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  let createdArticleId: number;

  it('POST /articles — should create an article', async () => {
    const res = await request(app.getHttpServer())
      .post('/articles')
      .send({ title: 'My Article', content: 'Some content', tags: ['nestjs', 'typescript'] })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('My Article');
    expect(res.body.content).toBe('Some content');
    expect(res.body.tags).toEqual(['nestjs', 'typescript']);
    createdArticleId = res.body.id;
  });

  it('POST /articles — should reject invalid data (title too short)', async () => {
    await request(app.getHttpServer())
      .post('/articles')
      .send({ title: 'Hi' })
      .expect(400);
  });

  it('POST /articles — should reject missing title', async () => {
    await request(app.getHttpServer())
      .post('/articles')
      .send({ content: 'No title here' })
      .expect(400);
  });

  it('GET /articles — should return all articles', async () => {
    const res = await request(app.getHttpServer())
      .get('/articles')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(1);
  });

  it('GET /articles/:id — should return a single article', async () => {
    const res = await request(app.getHttpServer())
      .get(`/articles/${createdArticleId}`)
      .expect(200);

    expect(res.body.id).toBe(createdArticleId);
    expect(res.body.title).toBe('My Article');
  });

  it('GET /articles/:id — should return 404 for non-existent article', async () => {
    await request(app.getHttpServer())
      .get('/articles/99999')
      .expect(404);
  });

  it('PATCH /articles/:id — should update an article', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/articles/${createdArticleId}`)
      .send({ title: 'Updated Article' })
      .expect(200);

    expect(res.body.title).toBe('Updated Article');
    expect(res.body.content).toBe('Some content');
  });

  it('GET /articles/:id/comments — should return comments array', async () => {
    const res = await request(app.getHttpServer())
      .get(`/articles/${createdArticleId}/comments`)
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
  });

  it('DELETE /articles/:id — should delete an article', async () => {
    await request(app.getHttpServer())
      .delete(`/articles/${createdArticleId}`)
      .expect(204);

    await request(app.getHttpServer())
      .get(`/articles/${createdArticleId}`)
      .expect(404);
  });
});
