// posts.service.ts — L'EXISTANT. Ne pas modifier.
import { Injectable, NotFoundException } from "@nestjs/common";
import { PostsRepository } from "./posts.repository";
import type { Post } from "./post.model";

@Injectable()
export class PostsService {
  constructor(private readonly repository: PostsRepository) {}

  getById(id: string): Post {
    const post = this.repository.findById(id);
    if (!post) throw new NotFoundException(`Post ${id} introuvable`);
    return post;
  }

  remove(id: string): void {
    this.repository.remove(id);
  }
}
