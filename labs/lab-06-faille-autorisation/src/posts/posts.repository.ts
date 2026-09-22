// posts.repository.ts — L'EXISTANT. Ne pas modifier.
import { Injectable } from "@nestjs/common";
import type { Post } from "./post.model";

@Injectable()
export class PostsRepository {
  private readonly posts = new Map<string, Post>([
    ["p1", { id: "p1", authorId: "alice", content: "Post d'Alice" }],
    ["p2", { id: "p2", authorId: "bob", content: "Post de Bob" }],
  ]);

  findById(id: string): Post | undefined {
    return this.posts.get(id);
  }

  remove(id: string): void {
    this.posts.delete(id);
  }
}
