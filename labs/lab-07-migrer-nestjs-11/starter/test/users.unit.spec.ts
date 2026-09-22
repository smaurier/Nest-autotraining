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

  it('findAll should return an array', () => {
    const result = service.findAll();
    expect(result).toEqual([]);
    expect(Array.isArray(result)).toBe(true);
  });

  it('create should add a user and return it', () => {
    const user = service.create({ name: 'John', email: 'john@test.com' });

    expect(user).toBeDefined();
    expect(user.id).toBeDefined();
    expect(user.name).toBe('John');
    expect(user.email).toBe('john@test.com');
    expect(service.findAll()).toHaveLength(1);
  });

  it('findOne should return a user by id', () => {
    const created = service.create({ name: 'John', email: 'john@test.com' });
    const found = service.findOne(created.id);

    expect(found).toBeDefined();
    expect(found.id).toBe(created.id);
    expect(found.name).toBe('John');
    expect(found.email).toBe('john@test.com');
  });

  it('findOne should throw NotFoundException for invalid id', () => {
    expect(() => service.findOne(999)).toThrow(NotFoundException);
  });

  it('update should modify a user', () => {
    const created = service.create({ name: 'John', email: 'john@test.com' });
    const updated = service.update(created.id, { name: 'Jane' });

    expect(updated.name).toBe('Jane');
    expect(updated.email).toBe('john@test.com');
    expect(updated.id).toBe(created.id);
  });

  it('remove should delete a user', () => {
    const created = service.create({ name: 'John', email: 'john@test.com' });
    service.remove(created.id);

    expect(service.findAll()).toHaveLength(0);
    expect(() => service.findOne(created.id)).toThrow(NotFoundException);
  });
});
