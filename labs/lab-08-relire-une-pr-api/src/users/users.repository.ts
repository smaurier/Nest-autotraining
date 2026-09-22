// users.repository.ts — L'EXISTANT. Ne pas modifier.
import { Injectable } from "@nestjs/common";
import type { User } from "./user.model";

@Injectable()
export class UsersRepository {
  private readonly users = new Map<string, User>([
    ["u1", { id: "u1", email: "alice@tribuzen.app", passwordHash: "hash-secret-alice", name: "Alice", bio: "", role: "member" }],
  ]);

  findById(id: string): User | undefined {
    return this.users.get(id);
  }

  save(user: User): User {
    this.users.set(user.id, user);
    return user;
  }
}
