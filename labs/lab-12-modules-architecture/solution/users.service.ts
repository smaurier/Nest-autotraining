import { Injectable } from '@nestjs/common';
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
  private users: User[] = [];
  private idCounter = 0;

  constructor(
    private readonly logger: LoggerService,
    private readonly dateService: DateService,
  ) {}

  findAll(): User[] {
    return this.users;
  }

  create(data: { name: string; email: string }): User {
    const user: User = {
      id: ++this.idCounter,
      name: data.name,
      email: data.email,
      createdAt: this.dateService.now(),
    };
    this.users.push(user);
    this.logger.log('UsersService', `Created user: ${user.name}`);
    return user;
  }
}
