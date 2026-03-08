import { Controller, Get, Post, Body } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // TODO: Implement GET /users
  // Hint: Use @Get() and return this.usersService.findAll()
  findAll() {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement POST /users
  // Hint: Use @Post() and @Body()
  create(body: { name: string; email: string }) {
    throw new Error('TODO: Not implemented');
  }
}
