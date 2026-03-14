import { Field, InputType, Int } from '@nestjs/graphql';

// TODO: Add @InputType() decorator
export class UpdateBookInput {
  // TODO: Expose 'title' as nullable String field
  // Hint: @Field({ nullable: true })
  title?: string;

  // TODO: Expose 'year' as nullable Int field
  // Hint: @Field(() => Int, { nullable: true })
  year?: number;

  // TODO: Expose 'genre' as nullable String field
  // Hint: @Field({ nullable: true })
  genre?: string;
}
