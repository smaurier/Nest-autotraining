import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // TODO: Implement GET /products/search?q=term
  // IMPORTANT: This route must be BEFORE GET /products/:id to avoid conflicts
  // Hint: @Get('search') with @Query('q')
  search(q: string) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement GET /products/stats/by-category
  // Hint: @Get('stats/by-category')
  statsByCategory() {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement GET /products
  findAll() {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement GET /products/:id
  findOne(id: string) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement POST /products
  create(createProductDto: CreateProductDto) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement PATCH /products/:id
  update(id: string, updateProductDto: UpdateProductDto) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement DELETE /products/:id
  remove(id: string) {
    throw new Error('TODO: Not implemented');
  }
}
