import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
  HttpCode,
  Header,
} from '@nestjs/common';
import { ArticlesService } from './articles.service';
import { CreateArticleDto } from './dto/create-article.dto';
import { UpdateArticleDto } from './dto/update-article.dto';

@Controller('articles')
export class ArticlesController {
  constructor(private readonly articlesService: ArticlesService) {}

  // TODO: Implement GET /articles
  // It should return all articles
  // Add @Header('X-Total-Count', '...') — this is optional, just call findAll
  // Hint: Use @Get()
  findAll() {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement GET /articles/:id
  // It should return a single article
  // Hint: Use @Get(':id') and @Param('id', ParseIntPipe)
  findOne(id: number) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement POST /articles
  // It should create an article
  // Hint: Use @Post() and @Body()
  create(createArticleDto: CreateArticleDto) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement PATCH /articles/:id
  // It should update an article
  // Hint: Use @Patch(':id'), @Param('id', ParseIntPipe), @Body()
  update(id: number, updateArticleDto: UpdateArticleDto) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement DELETE /articles/:id
  // It should delete an article and return 204 No Content
  // Hint: Use @Delete(':id'), @HttpCode(204)
  remove(id: number) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement GET /articles/:id/comments
  // It should return the comments of an article (nested route)
  // Hint: Use @Get(':id/comments')
  findComments(articleId: number) {
    throw new Error('TODO: Not implemented');
  }
}
