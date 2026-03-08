// TODO: Import PartialType from '@nestjs/common' (or from '@nestjs/mapped-types')
// TODO: Import CreateArticleDto
// TODO: Make UpdateArticleDto extend PartialType(CreateArticleDto)
// Hint: export class UpdateArticleDto extends PartialType(CreateArticleDto) {}

export class UpdateArticleDto {
  title?: string;
  content?: string;
  tags?: string[];
}
