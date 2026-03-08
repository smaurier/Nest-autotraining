import { Injectable, NotFoundException } from '@nestjs/common';
import { LoggerService } from '../shared/logger.service';
import { DateService } from '../shared/date.service';

export interface User {
  id: number;
  name: string;
  email: string;
  createdAt: string;
}

@Injectable()
export class UsersService {
  // TODO: Inject LoggerService and DateService
  // TODO: Declare private users array and idCounter
  // Hint:
  // constructor(
  //   private readonly logger: LoggerService,
  //   private readonly dateService: DateService,
  // ) {}

  constructor() {
    // TODO: Add injected dependencies
  }

  // TODO: Implement findAll(): User[]
  findAll(): User[] {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement create(data: { name: string; email: string }): User
  // It should create a user with auto-incremented id and set createdAt using DateService
  // Log the creation using LoggerService
  create(data: { name: string; email: string }): User {
    throw new Error('TODO: Not implemented');
  }
}
