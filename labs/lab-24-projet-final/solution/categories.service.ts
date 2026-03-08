import { Injectable } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: { name: string; description?: string }) {
    return this.prisma.category.create({ data });
  }

  findAll() {
    return this.prisma.category.findMany({ include: { products: true } });
  }

  findOne(id: number) {
    return this.prisma.category.findUnique({
      where: { id },
      include: { products: true },
    });
  }

  remove(id: number) {
    return this.prisma.category.delete({ where: { id } });
  }
}
