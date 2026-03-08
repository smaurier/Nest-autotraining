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

  // TODO: Test POST /users creates a user
  // Send a POST request with { name, email }
  // Verify status 201 and response body contains the user with an id
  // Hint: request(app.getHttpServer()).post('/users').send({ name: 'John', email: 'john@test.com' })
  it('POST /users should create a user', () => {
    throw new Error('TODO: Not implemented');
  });

  // TODO: Test GET /users returns all users
  // First create a user, then GET /users
  // Verify status 200 and response body is an array with the created user
  // Hint: Chain requests — first POST then GET
  it('GET /users should return all users', () => {
    throw new Error('TODO: Not implemented');
  });

  // TODO: Test GET /users/:id returns a single user
  // Create a user, then GET /users/:id
  // Verify status 200 and the correct user is returned
  it('GET /users/:id should return a single user', () => {
    throw new Error('TODO: Not implemented');
  });

  // TODO: Test GET /users/:id returns 404 for non-existent user
  // GET /users/999 should return status 404
  // Hint: request(app.getHttpServer()).get('/users/999').expect(404)
  it('GET /users/:id should return 404 for non-existent user', () => {
    throw new Error('TODO: Not implemented');
  });

  // TODO: Test PATCH /users/:id updates a user
  // Create a user, then PATCH /users/:id with updated data
  // Verify status 200 and the user is updated
  it('PATCH /users/:id should update a user', () => {
    throw new Error('TODO: Not implemented');
  });

  // TODO: Test DELETE /users/:id removes a user
  // Create a user, then DELETE /users/:id
  // Verify status 200, then GET /users should return empty array
  it('DELETE /users/:id should remove a user', () => {
    throw new Error('TODO: Not implemented');
  });
});
