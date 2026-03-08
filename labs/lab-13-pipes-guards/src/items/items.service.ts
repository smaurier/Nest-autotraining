import { Injectable, NotFoundException } from '@nestjs/common';

export interface Item {
  id: number;
  name: string;
  description: string;
}

@Injectable()
export class ItemsService {
  // TODO: Declare private items array and idCounter

  // TODO: Implement findAll(): Item[]
  findAll(): Item[] {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement findOne(id: number): Item
  // Throw NotFoundException if not found
  findOne(id: number): Item {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement create(data: { name: string; description?: string }): Item
  create(data: { name: string; description?: string }): Item {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement update(id: number, data: Partial<Item>): Item
  update(id: number, data: Partial<Item>): Item {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement remove(id: number): void
  remove(id: number): void {
    throw new Error('TODO: Not implemented');
  }
}
