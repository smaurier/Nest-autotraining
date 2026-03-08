import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  ParseIntPipe,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

// TODO: Add Swagger decorators to this controller
// Import ApiTags, ApiOperation, ApiResponse from '@nestjs/swagger'
//
// 1. Add @ApiTags('products') to the controller class
// 2. For each route, add:
//    @ApiOperation({ summary: '...' })
//    @ApiResponse({ status: 200/201, description: '...' })
//    @ApiResponse({ status: 404, description: 'Not found' }) (where applicable)
//
// Hint:
//   @ApiTags('products')
//   @Controller('products')
//   export class ProductsController { ... }

@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // TODO: Add @ApiOperation({ summary: 'Get all products' })
  // TODO: Add @ApiResponse({ status: 200, description: 'List of products' })
  @Get()
  findAll() {
    return this.productsService.findAll();
  }

  // TODO: Add Swagger decorators
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.findOne(id);
  }

  // TODO: Add Swagger decorators
  @Post()
  create(@Body() createProductDto: CreateProductDto) {
    return this.productsService.create(createProductDto);
  }

  // TODO: Add Swagger decorators
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateProductDto: UpdateProductDto,
  ) {
    return this.productsService.update(id, updateProductDto);
  }

  // TODO: Add Swagger decorators
  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.productsService.remove(id);
  }
}
