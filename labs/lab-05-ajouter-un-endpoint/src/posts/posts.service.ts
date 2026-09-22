// posts.service.ts — L'EXISTANT, EN PRODUCTION, que tu modifies pour ajouter une capacité.
// Les deux méthodes ci-dessous tournent déjà en prod : ne change ni leur signature ni leur
// comportement (le test de non-régression le vérifie).
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

  // TODO (ta tâche) : ajoute `getById(id: string): Post`, qui lève NotFoundException si le
  // post n'existe pas. Le repository a déjà `findById` — tu n'as rien à changer là-dedans.
}
