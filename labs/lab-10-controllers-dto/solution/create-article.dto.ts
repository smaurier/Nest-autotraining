import { IsString, IsNotEmpty, MinLength, IsOptional, IsArray } from 'class-validator';

export class CreateArticleDto {
  @IsString()
  @IsNotEmpty()
  @MinLength(3)
  title: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  tags?: string[];
}
