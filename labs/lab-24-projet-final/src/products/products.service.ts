import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto, UpdateProductDto } from './dto/create-product.dto';

// TODO: Inject PrismaService via constructor

// TODO: create(dto: CreateProductDto)
//   return this.prisma.product.create({ data: dto, include: { category: true } })

// TODO: findAll(search?: string)
//   Build where clause: if search is provided, filter by name containing search string
//     const where = search
//       ? { name: { contains: search } }
//       : {};
//   return this.prisma.product.findMany({ where, include: { category: true } })

// TODO: async findOne(id: number)
//   Find product with category included
//   If not found, throw NotFoundException
//   return product

// TODO: update(id: number, dto: UpdateProductDto)
//   return this.prisma.product.update({ where: { id }, data: dto, include: { category: true } })

// TODO: remove(id: number)
//   return this.prisma.product.delete({ where: { id } })

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // TODO: implement methods
}
