import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CreateBookInput {
  @Field()
  title: string;

  @Field(() => Int)
  year: number;

  @Field()
  genre: string;

  @Field(() => Int)
  authorId: number;
}
