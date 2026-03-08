import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateCategoryDto } from '../src/categories/dto/create-category.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  create(dto: CreateCategoryDto) {
    return this.prisma.category.create({ data: dto });
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
