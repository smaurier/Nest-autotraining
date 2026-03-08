import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UsersService } from '../src/users/users.service';

describe('UsersService (unit)', () => {
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UsersService],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  // TODO: Test that findAll returns an array
  // It should return an empty array initially
  // Hint: expect(service.findAll()).toEqual([])
  it('findAll should return an array', () => {
    throw new Error('TODO: Not implemented');
  });

  // TODO: Test that create adds a user and returns it
  // It should create a user with the given name and email
  // The returned user should have an auto-generated id
  // Hint: const user = service.create({ name: 'John', email: 'john@test.com' })
  it('create should add a user and return it', () => {
    throw new Error('TODO: Not implemented');
  });

  // TODO: Test that findOne returns a user by id
  // First create a user, then find it by id
  // Hint: const created = service.create({...}); service.findOne(created.id)
  it('findOne should return a user by id', () => {
    throw new Error('TODO: Not implemented');
  });

  // TODO: Test that findOne throws NotFoundException for an invalid id
  // It should throw when looking for a non-existent id
  // Hint: expect(() => service.findOne(999)).toThrow(NotFoundException)
  it('findOne should throw NotFoundException for invalid id', () => {
    throw new Error('TODO: Not implemented');
  });

  // TODO: Test that update modifies a user
  // Create a user, then update its name
  // Verify the returned user has the updated name
  // Hint: service.update(user.id, { name: 'Updated' })
  it('update should modify a user', () => {
    throw new Error('TODO: Not implemented');
  });

  // TODO: Test that remove deletes a user
  // Create a user, then remove it
  // Verify it's no longer in findAll results
  // Hint: service.remove(user.id); expect(service.findAll()).toHaveLength(0)
  it('remove should delete a user', () => {
    throw new Error('TODO: Not implemented');
  });
});
