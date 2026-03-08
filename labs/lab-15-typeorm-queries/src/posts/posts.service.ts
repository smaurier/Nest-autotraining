import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Post } from './post.entity';
import { Comment } from './comment.entity';
import { UsersService } from '../users/users.service';

@Injectable()
export class PostsService {
  // TODO: Inject Post repository, Comment repository, UsersService, and DataSource
  // Hint:
  // constructor(
  //   @InjectRepository(Post) private postsRepo: Repository<Post>,
  //   @InjectRepository(Comment) private commentsRepo: Repository<Comment>,
  //   private usersService: UsersService,
  //   private dataSource: DataSource,
  // ) {}

  constructor() {
    // TODO: Add injected dependencies
  }

  // TODO: Implement findWithPagination(page: number, limit: number)
  // Use QueryBuilder to paginate results:
  // - .skip((page - 1) * limit)
  // - .take(limit)
  // - Include user relation via leftJoinAndSelect
  // - Return { data: Post[], total: number, page: number, limit: number }
  // Hint:
  // const qb = this.postsRepo.createQueryBuilder('post')
  //   .leftJoinAndSelect('post.user', 'user')
  //   .skip((page - 1) * limit)
  //   .take(limit);
  // const [data, total] = await qb.getManyAndCount();
  async findWithPagination(page: number = 1, limit: number = 10) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement searchPosts(term: string)
  // Use QueryBuilder with WHERE LIKE clause to search by title
  // Hint:
  // return this.postsRepo.createQueryBuilder('post')
  //   .leftJoinAndSelect('post.user', 'user')
  //   .where('post.title LIKE :term', { term: `%${term}%` })
  //   .getMany();
  async searchPosts(term: string): Promise<Post[]> {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement findByUserWithComments(userId: number)
  // Use QueryBuilder with leftJoinAndSelect for both user and comments
  // Filter by user id
  // Hint:
  // return this.postsRepo.createQueryBuilder('post')
  //   .leftJoinAndSelect('post.user', 'user')
  //   .leftJoinAndSelect('post.comments', 'comments')
  //   .where('user.id = :userId', { userId })
  //   .getMany();
  async findByUserWithComments(userId: number): Promise<Post[]> {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement createPostWithComments(data)
  // Use a transaction to create a post and its comments atomically
  // data: { title: string, content: string, userId: number, comments: { content: string }[] }
  // Hint: Use DataSource.transaction() or QueryRunner
  // return this.dataSource.transaction(async (manager) => {
  //   const user = await this.usersService.findOne(data.userId);
  //   const post = manager.create(Post, { title, content, user });
  //   const savedPost = await manager.save(post);
  //   for (const c of data.comments) {
  //     const comment = manager.create(Comment, { content: c.content, post: savedPost });
  //     await manager.save(comment);
  //   }
  //   return manager.findOne(Post, { where: { id: savedPost.id }, relations: ['user', 'comments'] });
  // });
  async createPostWithComments(data: {
    title: string;
    content: string;
    userId: number;
    comments: { content: string }[];
  }): Promise<Post> {
    throw new Error('TODO: Not implemented');
  }
}
