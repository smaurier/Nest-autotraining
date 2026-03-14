import { Field, Int, ObjectType } from '@nestjs/graphql';

// TODO: Add @ObjectType() decorator
export class Author {
  // TODO: Expose 'id' as Int field
  // Hint: @Field(() => Int)
  id: number;

  // TODO: Expose 'name' as String field
  // Hint: @Field()
  name: string;

  // TODO: Expose 'nationality' as String field
  // Hint: @Field()
  nationality: string;
}
