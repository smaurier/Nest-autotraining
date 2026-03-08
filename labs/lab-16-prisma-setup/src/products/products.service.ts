import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';

// TODO: Inject PrismaService via constructor

// TODO: create(dto: CreateProductDto)
//   Use this.prisma.product.create({ data: dto })

// TODO: findAll()
//   Use this.prisma.product.findMany({ include: { category: true } })

// TODO: findOne(id: number)
//   Use this.prisma.product.findUnique({ where: { id }, include: { category: true } })
//   If not found, throw new NotFoundException(`Product #${id} not found`)

// TODO: update(id: number, dto: UpdateProductDto)
//   Use this.prisma.product.update({ where: { id }, data: dto, include: { category: true } })

// TODO: remove(id: number)
//   Use this.prisma.product.delete({ where: { id } })

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // TODO: implement methods
}
