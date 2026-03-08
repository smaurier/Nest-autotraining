import { Injectable } from '@nestjs/common';

export interface User {
  id: number;
  username: string;
  password: string;
  roles: string[];
}

@Injectable()
export class UsersService {
  // TODO: Declare a private array to store users in memory
  // Hint: private users: User[] = [];

  // TODO: Declare a private counter for auto-incrementing IDs
  // Hint: private idCounter = 0;

  // TODO: Implement create(data)
  // It should create a new user with an auto-incremented id
  // The data object contains: username, password (already hashed), roles
  // Push the user to the array and return it
  // Hint: const user: User = { id: ++this.idCounter, ...data };
  create(data: { username: string; password: string; roles: string[] }): User {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement findByUsername(username)
  // It should find and return a user by their username
  // Return undefined if not found
  // Hint: return this.users.find(u => u.username === username);
  findByUsername(username: string): User | undefined {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement findById(id)
  // It should find and return a user by their id
  // Return undefined if not found
  findById(id: number): User | undefined {
    throw new Error('TODO: Not implemented');
  }
}
