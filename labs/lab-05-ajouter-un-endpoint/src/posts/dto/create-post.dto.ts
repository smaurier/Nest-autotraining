// create-post.dto.ts — L'EXISTANT. Ne pas modifier.
import { IsNotEmpty, IsString } from "class-validator";

export class CreatePostDto {
  @IsString() @IsNotEmpty() familyId!: string;
  @IsString() @IsNotEmpty() authorId!: string;
  @IsString() @IsNotEmpty() content!: string;
}
