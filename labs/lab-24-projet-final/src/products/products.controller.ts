import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ProductsService } from './products.service';
import { CreateProductDto, UpdateProductDto } from './dto/create-product.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// TODO: Decorate with @ApiTags('products') and @Controller('products')

// TODO: POST /products — create a new product (admin only)
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles('admin')
//   @ApiBearerAuth()
//   @Post()
//   create(@Body() dto: CreateProductDto)

// TODO: GET /products — list all products with optional search
//   @ApiQuery({ name: 'search', required: false })
//   @Get()
//   findAll(@Query('search') search?: string)

// TODO: GET /products/:id — get one product
//   @Get(':id')
//   findOne(@Param('id', ParseIntPipe) id: number)

// TODO: PATCH /products/:id — update a product (admin only)
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles('admin')
//   @ApiBearerAuth()
//   @Patch(':id')
//   update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateProductDto)

// TODO: DELETE /products/:id — delete a product (admin only)
//   @UseGuards(JwtAuthGuard, RolesGuard)
//   @Roles('admin')
//   @ApiBearerAuth()
//   @Delete(':id')
//   remove(@Param('id', ParseIntPipe) id: number)

@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  // TODO: implement endpoints
}
