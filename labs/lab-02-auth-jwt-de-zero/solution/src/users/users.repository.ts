// users.repository.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";

export interface StoredUser {
  id: string;
  email: string;
  passwordHash: string;
}

@Injectable()
export class UsersRepository {
  private readonly users = new Map<string, StoredUser>();

  findByEmail(email: string): StoredUser | undefined {
    const lower = email.toLowerCase();
    return [...this.users.values()].find((u) => u.email.toLowerCase() === lower);
  }

  create(user: { email: string; passwordHash: string }): StoredUser {
    const created: StoredUser = { id: randomUUID(), ...user };
    this.users.set(created.id, created);
    return created;
  }
}
