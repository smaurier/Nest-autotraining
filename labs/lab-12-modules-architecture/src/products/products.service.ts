import { Injectable, NotFoundException } from '@nestjs/common';
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
  // TODO: Inject LoggerService and DateService
  // TODO: Declare private products array and idCounter

  constructor() {
    // TODO: Add injected dependencies
  }

  // TODO: Implement findAll(): Product[]
  findAll(): Product[] {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement create(data: { name: string; price: number }): Product
  // Create a product with auto-incremented id and createdAt from DateService
  // Log the creation using LoggerService
  create(data: { name: string; price: number }): Product {
    throw new Error('TODO: Not implemented');
  }
}
