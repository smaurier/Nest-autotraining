import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
// import { User } from '../users/user.entity';
// import { Comment } from './comment.entity';

// TODO: Define the Post entity using TypeORM decorators
// It should have:
// - id: auto-generated primary key (number)
// - title: string column
// - content: text column
// - createdAt: auto-generated date column (@CreateDateColumn)
// - user: many-to-one relation with User (eager: false)
// - comments: one-to-many relation with Comment
//
// Hint:
// @ManyToOne(() => User, user => user.posts, { onDelete: 'CASCADE' })
// user: User;

@Entity()
export class Post {
  @PrimaryGeneratedColumn()
  id: number;

  // TODO: Add @Column() decorator for title
  title: string;

  // TODO: Add @Column('text') decorator for content
  content: string;

  // TODO: Add @CreateDateColumn() decorator for createdAt
  createdAt: Date;

  // TODO: Add @ManyToOne(() => User, user => user.posts) relation
  // user: User;

  // TODO: Add @OneToMany(() => Comment, comment => comment.post) relation
  // comments: Comment[];
}
