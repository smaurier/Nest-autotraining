import { Controller, Get, Post, Body } from '@nestjs/common';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // TODO: Implement GET /products
  findAll() {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement POST /products
  create(body: { name: string; price: number }) {
    throw new Error('TODO: Not implemented');
  }
}
