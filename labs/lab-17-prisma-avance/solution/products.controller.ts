import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Post()
  create(
    @Body()
    data: { name: string; price: number; stock?: number; categoryId?: number },
  ) {
    return this.productsService.create(data);
  }

  @Get()
  findAll(@Query('cursor') cursor?: string, @Query('take') take?: string) {
    return this.productsService.findWithCursorPagination(
      cursor ? parseInt(cursor) : undefined,
      take ? parseInt(take) : 10,
    );
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.softDelete(id);
  }
}
