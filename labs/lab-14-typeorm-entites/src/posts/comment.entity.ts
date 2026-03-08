import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
// import { Post } from './post.entity';

// TODO: Define the Comment entity using TypeORM decorators
// It should have:
// - id: auto-generated primary key (number)
// - content: text column
// - createdAt: auto-generated date column
// - post: many-to-one relation with Post
//
// Hint:
// @ManyToOne(() => Post, post => post.comments, { onDelete: 'CASCADE' })
// post: Post;

@Entity()
export class Comment {
  @PrimaryGeneratedColumn()
  id: number;

  // TODO: Add @Column('text') decorator for content
  content: string;

  // TODO: Add @CreateDateColumn() for createdAt
  createdAt: Date;

  // TODO: Add @ManyToOne(() => Post, post => post.comments) relation
  // post: Post;
}
