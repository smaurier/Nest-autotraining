import { Controller, Get, Post, Body, Param, ParseIntPipe } from '@nestjs/common';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // TODO: Implement GET /posts
  findAll() {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement GET /posts/:id
  findOne(id: number) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement POST /posts
  // Body: { title, content, userId }
  create(body: { title: string; content: string; userId: number }) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement POST /posts/:id/comments
  // Body: { content }
  addComment(id: number, body: { content: string }) {
    throw new Error('TODO: Not implemented');
  }
}
