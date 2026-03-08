import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';

describe('Tasks CRUD (e2e)', () => {
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

  let createdTaskId: number;

  it('POST /tasks — should create a task', async () => {
    const res = await request(app.getHttpServer())
      .post('/tasks')
      .send({ title: 'My first task', description: 'A test task' })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('My first task');
    expect(res.body.description).toBe('A test task');
    expect(res.body.done).toBe(false);
    createdTaskId = res.body.id;
  });

  it('POST /tasks — should create a task without description', async () => {
    const res = await request(app.getHttpServer())
      .post('/tasks')
      .send({ title: 'Task without description' })
      .expect(201);

    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('Task without description');
    expect(res.body.done).toBe(false);
  });

  it('GET /tasks — should return all tasks', async () => {
    const res = await request(app.getHttpServer())
      .get('/tasks')
      .expect(200);

    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(2);
  });

  it('GET /tasks/:id — should return a single task', async () => {
    const res = await request(app.getHttpServer())
      .get(`/tasks/${createdTaskId}`)
      .expect(200);

    expect(res.body.id).toBe(createdTaskId);
    expect(res.body.title).toBe('My first task');
  });

  it('GET /tasks/:id — should return 404 for non-existent task', async () => {
    await request(app.getHttpServer())
      .get('/tasks/99999')
      .expect(404);
  });

  it('PATCH /tasks/:id — should update a task', async () => {
    const res = await request(app.getHttpServer())
      .patch(`/tasks/${createdTaskId}`)
      .send({ title: 'Updated task', done: true })
      .expect(200);

    expect(res.body.title).toBe('Updated task');
    expect(res.body.done).toBe(true);
    expect(res.body.description).toBe('A test task');
  });

  it('PATCH /tasks/:id — should return 404 for non-existent task', async () => {
    await request(app.getHttpServer())
      .patch('/tasks/99999')
      .send({ title: 'Nope' })
      .expect(404);
  });

  it('DELETE /tasks/:id — should delete a task', async () => {
    await request(app.getHttpServer())
      .delete(`/tasks/${createdTaskId}`)
      .expect(200);

    await request(app.getHttpServer())
      .get(`/tasks/${createdTaskId}`)
      .expect(404);
  });

  it('DELETE /tasks/:id — should return 404 for non-existent task', async () => {
    await request(app.getHttpServer())
      .delete('/tasks/99999')
      .expect(404);
  });
});
