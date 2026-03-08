import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CategoriesService } from './categories.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// TODO: Decorate with @ApiTags('categories') and @Controller('categories')

// TODO: POST /categories — create a category (admin only)
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles('admin')
//   @ApiBearerAuth()
//   @Post()
//   create(@Body() data: { name: string; description?: string })

// TODO: GET /categories — list all categories with products
//   @Get()
//   findAll()

// TODO: GET /categories/:id — get one category with products
//   @Get(':id')
//   findOne(@Param('id', ParseIntPipe) id: number)

// TODO: DELETE /categories/:id — delete a category (admin only)
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles('admin')
//   @ApiBearerAuth()
//   @Delete(':id')
//   remove(@Param('id', ParseIntPipe) id: number)

@ApiTags('categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  // TODO: implement endpoints
}
