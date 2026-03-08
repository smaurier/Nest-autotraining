import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
}

@Injectable()
export class ProductsService {
  // TODO: Inject ConfigService in the constructor
  // Hint: constructor(private configService: ConfigService) {}

  // TODO: Declare private storage and counter
  // Hint: private products: Product[] = [];
  // Hint: private idCounter = 0;

  // TODO: Implement getAppName()
  // It should return the app name from config
  // Hint: return this.configService.get<string>('app.name');
  getAppName(): string {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement findAll()
  // It should return all products
  findAll(): Product[] {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement findOne(id)
  // It should return a product by id, throw NotFoundException if not found
  findOne(id: number): Product {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement create(dto)
  // It should create a product with auto-incremented id
  create(dto: CreateProductDto): Product {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement update(id, dto)
  // It should update a product
  update(id: number, dto: UpdateProductDto): Product {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement remove(id)
  // It should remove a product
  remove(id: number): void {
    throw new Error('TODO: Not implemented');
  }
}
