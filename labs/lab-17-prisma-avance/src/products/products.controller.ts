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

// TODO: Decorate with @Controller('products')
// TODO: Inject ProductsService via constructor

// TODO: POST /products — create a product (for test seeding)
//   @Post()
//   create(@Body() data: { name: string; price: number; stock?: number; categoryId?: number })
//   Use this.productsService.create(data)

// TODO: GET /products — cursor-based pagination
//   @Get()
//   findAll(@Query('cursor') cursor?: string, @Query('take') take?: string)
//   Parse cursor and take as numbers (default take = 10)
//   Return this.productsService.findWithCursorPagination(
//     cursor ? parseInt(cursor) : undefined,
//     take ? parseInt(take) : 10,
//   )

// TODO: DELETE /products/:id — soft delete
//   @Delete(':id')
//   remove(@Param('id', ParseIntPipe) id: number)
//   Return this.productsService.softDelete(id)

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // TODO: implement endpoints
}
