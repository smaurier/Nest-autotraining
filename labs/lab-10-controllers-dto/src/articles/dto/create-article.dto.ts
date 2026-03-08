// TODO: Import decorators from 'class-validator':
// IsString, IsNotEmpty, MinLength, IsOptional, IsArray

export class CreateArticleDto {
  // TODO: Add validation decorators
  // @IsString()
  // @IsNotEmpty()
  // @MinLength(3)
  title: string;

  // TODO: Add validation decorators
  // @IsString()
  // @IsOptional()
  content?: string;

  // TODO: Add validation decorators
  // @IsArray()
  // @IsOptional()
  // @IsString({ each: true })
  tags?: string[];
}
