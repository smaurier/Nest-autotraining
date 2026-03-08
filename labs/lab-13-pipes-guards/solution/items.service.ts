import { Injectable, NotFoundException } from '@nestjs/common';

export interface Item {
  id: number;
  name: string;
  description: string;
}

@Injectable()
export class ItemsService {
  private items: Item[] = [];
  private idCounter = 0;

  findAll(): Item[] {
    return this.items;
  }

  findOne(id: number): Item {
    const item = this.items.find((i) => i.id === id);
    if (!item) {
      throw new NotFoundException(`Item with id ${id} not found`);
    }
    return item;
  }

  create(data: { name: string; description?: string }): Item {
    const item: Item = {
      id: ++this.idCounter,
      name: data.name,
      description: data.description || '',
    };
    this.items.push(item);
    return item;
  }

  update(id: number, data: Partial<Item>): Item {
    const item = this.findOne(id);
    Object.assign(item, data);
    return item;
  }

  remove(id: number): void {
    const item = this.findOne(id);
    const index = this.items.indexOf(item);
    this.items.splice(index, 1);
  }
}
