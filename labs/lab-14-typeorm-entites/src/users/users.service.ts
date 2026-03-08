import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from './user.entity';

@Injectable()
export class UsersService {
  // TODO: Inject the User repository
  // Hint: constructor(@InjectRepository(User) private usersRepo: Repository<User>) {}

  constructor() {
    // TODO: Add @InjectRepository(User) private usersRepo: Repository<User>
  }

  // TODO: Implement findAll()
  // Return all users with their posts relation
  // Hint: this.usersRepo.find({ relations: ['posts'] })
  async findAll(): Promise<User[]> {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement findOne(id)
  // Return a user by id with posts relation
  // Throw NotFoundException if not found
  async findOne(id: number): Promise<User> {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement create(data: { name: string; email: string })
  // Use this.usersRepo.create() and this.usersRepo.save()
  async create(data: { name: string; email: string }): Promise<User> {
    throw new Error('TODO: Not implemented');
  }
}
