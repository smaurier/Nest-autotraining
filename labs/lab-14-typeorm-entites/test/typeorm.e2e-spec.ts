import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('TypeORM Entities (e2e)', () => {
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

  let userId: number;
  let postId: number;

  describe('Users', () => {
    it('POST /users — should create a user', async () => {
      const res = await request(app.getHttpServer())
        .post('/users')
        .send({ name: 'Alice', email: 'alice@example.com' })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.name).toBe('Alice');
      expect(res.body.email).toBe('alice@example.com');
      userId = res.body.id;
    });

    it('GET /users — should return all users', async () => {
      const res = await request(app.getHttpServer())
        .get('/users')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
    });

    it('GET /users/:id — should return a user with posts', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/${userId}`)
        .expect(200);

      expect(res.body.id).toBe(userId);
      expect(res.body.name).toBe('Alice');
      expect(res.body).toHaveProperty('posts');
      expect(Array.isArray(res.body.posts)).toBe(true);
    });

    it('GET /users/:id — should return 404 for non-existent user', async () => {
      await request(app.getHttpServer())
        .get('/users/99999')
        .expect(404);
    });
  });

  describe('Posts', () => {
    it('POST /posts — should create a post for a user', async () => {
      const res = await request(app.getHttpServer())
        .post('/posts')
        .send({ title: 'My First Post', content: 'Hello World', userId })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.title).toBe('My First Post');
      expect(res.body.content).toBe('Hello World');
      expect(res.body).toHaveProperty('createdAt');
      postId = res.body.id;
    });

    it('GET /posts — should return all posts with user', async () => {
      const res = await request(app.getHttpServer())
        .get('/posts')
        .expect(200);

      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThanOrEqual(1);
      expect(res.body[0]).toHaveProperty('user');
    });

    it('GET /posts/:id — should return a post with user and comments', async () => {
      const res = await request(app.getHttpServer())
        .get(`/posts/${postId}`)
        .expect(200);

      expect(res.body.id).toBe(postId);
      expect(res.body).toHaveProperty('user');
      expect(res.body).toHaveProperty('comments');
    });

    it('POST /posts/:id/comments — should add a comment', async () => {
      const res = await request(app.getHttpServer())
        .post(`/posts/${postId}/comments`)
        .send({ content: 'Great post!' })
        .expect(201);

      expect(res.body).toHaveProperty('id');
      expect(res.body.content).toBe('Great post!');
    });

    it('GET /posts/:id — should now include the comment', async () => {
      const res = await request(app.getHttpServer())
        .get(`/posts/${postId}`)
        .expect(200);

      expect(res.body.comments.length).toBeGreaterThanOrEqual(1);
      expect(res.body.comments[0].content).toBe('Great post!');
    });
  });

  describe('Relations', () => {
    it('User should have posts after creating a post', async () => {
      const res = await request(app.getHttpServer())
        .get(`/users/${userId}`)
        .expect(200);

      expect(res.body.posts.length).toBeGreaterThanOrEqual(1);
      expect(res.body.posts[0].title).toBe('My First Post');
    });
  });
});
