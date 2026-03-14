import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class UpdateBookInput {
  @Field({ nullable: true })
  title?: string;

  @Field(() => Int, { nullable: true })
  year?: number;

  @Field({ nullable: true })
  genre?: string;
}
