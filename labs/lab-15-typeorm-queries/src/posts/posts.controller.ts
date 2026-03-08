import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { PostsService } from './posts.service';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  // TODO: Implement GET /posts?page=1&limit=10
  // Use @Query('page') and @Query('limit') with default values
  // Hint: Use DefaultValuePipe and ParseIntPipe:
  // @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number
  findWithPagination(page: number, limit: number) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement GET /posts/search?term=hello
  // Use @Query('term') to get the search term
  searchPosts(term: string) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement GET /posts/user/:userId
  // Return posts for a specific user with comments
  findByUser(userId: number) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement POST /posts/with-comments
  // Body: { title, content, userId, comments: [{ content }] }
  // Use transaction to create post with comments
  createWithComments(body: {
    title: string;
    content: string;
    userId: number;
    comments: { content: string }[];
  }) {
    throw new Error('TODO: Not implemented');
  }
}
