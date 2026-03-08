import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './post.entity';
import { Comment } from './comment.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class PostsService {
  // TODO: Inject Post repository, Comment repository, and UsersService
  // Hint:
  // constructor(
  //   @InjectRepository(Post) private postsRepo: Repository<Post>,
  //   @InjectRepository(Comment) private commentsRepo: Repository<Comment>,
  //   private usersService: UsersService,
  // ) {}

  constructor() {
    // TODO: Add injected dependencies
  }

  // TODO: Implement findAll()
  // Return all posts with user and comments relations
  async findAll(): Promise<Post[]> {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement findOne(id)
  // Return a post by id with user and comments relations
  // Throw NotFoundException if not found
  async findOne(id: number): Promise<Post> {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement create(data: { title: string; content: string; userId: number })
  // 1. Find the user via UsersService
  // 2. Create the post entity and assign the user
  // 3. Save and return
  async create(data: { title: string; content: string; userId: number }): Promise<Post> {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement addComment(postId: number, data: { content: string })
  // 1. Find the post
  // 2. Create a comment and assign the post
  // 3. Save and return
  async addComment(postId: number, data: { content: string }): Promise<Comment> {
    throw new Error('TODO: Not implemented');
  }
}
