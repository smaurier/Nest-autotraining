import { Injectable } from '@nestjs/common';

export interface User {
  id: number;
  username: string;
  password: string;
  roles: string[];
}

@Injectable()
export class UsersService {
  private users: User[] = [];
  private idCounter = 0;

  create(data: { username: string; password: string; roles: string[] }): User {
    const user: User = {
      id: ++this.idCounter,
      username: data.username,
      password: data.password,
      roles: data.roles,
    };
    this.users.push(user);
    return user;
  }

  findByUsername(username: string): User | undefined {
    return this.users.find((u) => u.username === username);
  }

  findById(id: number): User | undefined {
    return this.users.find((u) => u.id === id);
  }
}
