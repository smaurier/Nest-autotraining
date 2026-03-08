import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// TODO: Inject PrismaService via constructor

// TODO: create(data: { name: string; description?: string })
//   return this.prisma.category.create({ data })

// TODO: findAll()
//   return this.prisma.category.findMany({ include: { products: true } })

// TODO: findOne(id: number)
//   return this.prisma.category.findUnique({ where: { id }, include: { products: true } })

// TODO: remove(id: number)
//   return this.prisma.category.delete({ where: { id } })

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  // TODO: implement methods
}
