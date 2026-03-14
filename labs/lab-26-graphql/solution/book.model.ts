import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Author } from './author.model';

@ObjectType()
export class Book {
  @Field(() => Int)
  id: number;

  @Field()
  title: string;

  @Field(() => Int)
  year: number;

  @Field()
  genre: string;

  @Field(() => Int)
  authorId: number;

  @Field(() => Author, { nullable: true })
  author?: Author;
}
