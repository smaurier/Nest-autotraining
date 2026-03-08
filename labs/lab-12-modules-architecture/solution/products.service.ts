import { Injectable } from '@nestjs/common';
import { LoggerService } from '../shared/logger.service';
import { DateService } from '../shared/date.service';

export interface Product {
  id: number;
  name: string;
  price: number;
  createdAt: string;
}

@Injectable()
export class ProductsService {
  private products: Product[] = [];
  private idCounter = 0;

  constructor(
    private readonly logger: LoggerService,
    private readonly dateService: DateService,
  ) {}

  findAll(): Product[] {
    return this.products;
  }

  create(data: { name: string; price: number }): Product {
    const product: Product = {
      id: ++this.idCounter,
      name: data.name,
      price: data.price,
      createdAt: this.dateService.now(),
    };
    this.products.push(product);
    this.logger.log('ProductsService', `Created product: ${product.name}`);
    return product;
  }
}
