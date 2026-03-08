import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

// TODO: Decorate the class with @Controller('products')
// TODO: Inject ProductsService via constructor

// TODO: POST /products — create a new product
//   Use @Post(), @Body() to get CreateProductDto
//   Return this.productsService.create(dto)

// TODO: GET /products — list all products (with category included)
//   Use @Get()
//   Return this.productsService.findAll()

// TODO: GET /products/:id — get one product (with category included)
//   Use @Get(':id'), @Param('id', ParseIntPipe)
//   Return this.productsService.findOne(id)

// TODO: PATCH /products/:id — update a product
//   Use @Patch(':id'), @Param('id', ParseIntPipe), @Body() UpdateProductDto
//   Return this.productsService.update(id, dto)

// TODO: DELETE /products/:id — delete a product
//   Use @Delete(':id'), @Param('id', ParseIntPipe)
//   Return this.productsService.remove(id)

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // TODO: implement endpoints
}
