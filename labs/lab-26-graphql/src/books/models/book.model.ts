import { Field, Int, ObjectType } from '@nestjs/graphql';
import { Author } from './author.model';

// TODO: Add @ObjectType() decorator
export class Book {
  // TODO: Expose 'id' as Int field
  // Hint: @Field(() => Int)
  id: number;

  // TODO: Expose 'title' as String field
  // Hint: @Field()
  title: string;

  // TODO: Expose 'year' as Int field
  // Hint: @Field(() => Int)
  year: number;

  // TODO: Expose 'genre' as String field
  // Hint: @Field()
  genre: string;

  // TODO: Expose 'authorId' as Int field
  // This field is used internally to link to the author
  // Hint: @Field(() => Int)
  authorId: number;

  // TODO: Expose 'author' as Author field (nullable)
  // This will be resolved by a @ResolveField in the resolver
  // Hint: @Field(() => Author, { nullable: true })
  author?: Author;
}
