// posts.repository.ts — L'EXISTANT, en production. Le stockage supporte DÉJÀ la recherche
// par id (findById) : la donnée est prête, il manque juste le fil qui la relie à une route
// HTTP. Ne pas modifier.
import { Injectable } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { Post } from "./post.model";

@Injectable()
export class PostsRepository {
  private readonly posts: Post[] = [
    { id: "p1", familyId: "f1", authorId: "u1", content: "Pique-nique dimanche", createdAt: "2026-09-01T10:00:00.000Z" },
    { id: "p2", familyId: "f1", authorId: "u2", content: "Léa a perdu une dent", createdAt: "2026-09-05T14:30:00.000Z" },
  ];

  listByFamily(familyId: string): Post[] {
    return this.posts.filter((p) => p.familyId === familyId);
  }

  findById(id: string): Post | undefined {
    return this.posts.find((p) => p.id === id);
  }

  create(input: { familyId: string; authorId: string; content: string }): Post {
    const post: Post = { id: randomUUID(), createdAt: new Date().toISOString(), ...input };
    this.posts.push(post);
    return post;
  }
}
