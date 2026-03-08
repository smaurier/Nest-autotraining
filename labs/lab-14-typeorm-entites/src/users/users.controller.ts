import { Controller, Get, Post, Body, Param, ParseIntPipe } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // TODO: Implement GET /users
  findAll() {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement GET /users/:id
  findOne(id: number) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement POST /users
  create(body: { name: string; email: string }) {
    throw new Error('TODO: Not implemented');
  }
}
