import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
} from 'typeorm';
// import { Post } from '../posts/post.entity';

// TODO: Define the User entity using TypeORM decorators
// It should have:
// - id: auto-generated primary key (number)
// - name: string column
// - email: string column (unique)
// - posts: one-to-many relation with Post entity
//
// Hint:
// @Entity()
// export class User {
//   @PrimaryGeneratedColumn()
//   id: number;
//
//   @Column()
//   name: string;
//
//   @Column({ unique: true })
//   email: string;
//
//   @OneToMany(() => Post, post => post.user)
//   posts: Post[];
// }

@Entity()
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  // TODO: Add @Column() decorator for name
  name: string;

  // TODO: Add @Column({ unique: true }) decorator for email
  email: string;

  // TODO: Add @OneToMany(() => Post, post => post.user) relation
  // Hint: Import Post from '../posts/post.entity'
  // posts: Post[];
}
