import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCategoryDto } from './dto/create-category.dto';

// TODO: Inject PrismaService via constructor

// TODO: create(dto: CreateCategoryDto)
//   Use this.prisma.category.create({ data: dto })

// TODO: findAll()
//   Use this.prisma.category.findMany({ include: { products: true } })

// TODO: findOne(id: number)
//   Use this.prisma.category.findUnique({ where: { id }, include: { products: true } })

// TODO: remove(id: number)
//   Use this.prisma.category.delete({ where: { id } })

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  // TODO: implement methods
}
