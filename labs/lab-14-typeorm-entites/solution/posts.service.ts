import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Post } from './post.entity';
import { Comment } from './comment.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class PostsService {
  constructor(
    @InjectRepository(Post)
    private postsRepo: Repository<Post>,
    @InjectRepository(Comment)
    private commentsRepo: Repository<Comment>,
    private usersService: UsersService,
  ) {}

  async findAll(): Promise<Post[]> {
    return this.postsRepo.find({ relations: ['user', 'comments'] });
  }

  async findOne(id: number): Promise<Post> {
    const post = await this.postsRepo.findOne({
      where: { id },
      relations: ['user', 'comments'],
    });
    if (!post) {
      throw new NotFoundException(`Post with id ${id} not found`);
    }
    return post;
  }

  async create(data: { title: string; content: string; userId: number }): Promise<Post> {
    const user = await this.usersService.findOne(data.userId);
    const post = this.postsRepo.create({
      title: data.title,
      content: data.content,
      user,
    });
    return this.postsRepo.save(post);
  }

  async addComment(postId: number, data: { content: string }): Promise<Comment> {
    const post = await this.findOne(postId);
    const comment = this.commentsRepo.create({
      content: data.content,
      post,
    });
    return this.commentsRepo.save(comment);
  }
}
