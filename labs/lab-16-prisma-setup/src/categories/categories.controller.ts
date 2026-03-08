import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Delete,
} from '@nestjs/common';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';

// TODO: Decorate the class with @Controller('categories')
// TODO: Inject CategoriesService via constructor

// TODO: POST /categories — create a new category
//   Use @Post(), @Body() to get CreateCategoryDto
//   Return this.categoriesService.create(dto)

// TODO: GET /categories — list all categories
//   Use @Get()
//   Return this.categoriesService.findAll()

// TODO: GET /categories/:id — get one category with its products
//   Use @Get(':id'), @Param('id', ParseIntPipe)
//   Return this.categoriesService.findOne(id)

// TODO: DELETE /categories/:id — delete a category
//   Use @Delete(':id'), @Param('id', ParseIntPipe)
//   Return this.categoriesService.remove(id)

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // TODO: implement endpoints
}
