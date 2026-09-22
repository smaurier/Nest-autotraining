// posts.service.ts — SOLUTION DE RÉFÉRENCE (commentée). Ne l'ouvre pas avant ton GREEN.
import { Injectable, NotFoundException } from "@nestjs/common";
import { PostsRepository } from "./posts.repository";
import type { Post } from "./post.model";

@Injectable()
export class PostsService {
  constructor(private readonly repository: PostsRepository) {}

  listByFamily(familyId: string): Post[] {
    return this.repository.listByFamily(familyId);
  }

  create(input: { familyId: string; authorId: string; content: string }): Post {
    return this.repository.create(input);
  }

  getById(id: string): Post {
    const post = this.repository.findById(id);
    if (!post) throw new NotFoundException(`Post ${id} introuvable`);
    return post;
  }
}
