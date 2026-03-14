import { Field, InputType, Int } from '@nestjs/graphql';

// TODO: Add @InputType() decorator
export class CreateBookInput {
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
  // Hint: @Field(() => Int)
  authorId: number;
}
