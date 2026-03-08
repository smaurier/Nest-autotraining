import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CreateProductDto } from '../src/products/dto/create-product.dto';
import { UpdateProductDto } from '../src/products/dto/update-product.dto';

export interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
}

@Injectable()
export class ProductsService {
  private products: Product[] = [];
  private idCounter = 0;

  constructor(private configService: ConfigService) {}

  getAppName(): string {
    return this.configService.get<string>('app.name');
  }

  findAll(): Product[] {
    return this.products;
  }

  findOne(id: number): Product {
    const product = this.products.find((p) => p.id === id);
    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }
    return product;
  }

  create(dto: CreateProductDto): Product {
    const product: Product = {
      id: ++this.idCounter,
      name: dto.name,
      description: dto.description || '',
      price: dto.price,
    };
    this.products.push(product);
    return product;
  }

  update(id: number, dto: UpdateProductDto): Product {
    const product = this.findOne(id);
    Object.assign(product, dto);
    return product;
  }

  remove(id: number): void {
    const product = this.findOne(id);
    const index = this.products.indexOf(product);
    this.products.splice(index, 1);
  }
}
