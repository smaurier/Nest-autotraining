import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// TODO: Inject PrismaService via constructor

// TODO: create(data: { name: string; price: number; stock?: number; categoryId?: number })
//   Use this.prisma.product.create({ data })

// TODO: findWithCursorPagination(cursor?: number, take: number = 10)
//   Build query args:
//     const args: any = {
//       take,
//       orderBy: { id: 'asc' },
//       include: { category: true },
//     };
//     if (cursor) {
//       args.skip = 1;          // skip the cursor item itself
//       args.cursor = { id: cursor };
//     }
//   Execute: const products = await this.prisma.product.findMany(args);
//   Return: { data: products, nextCursor: products.length === take ? products[products.length - 1].id : null }

// TODO: softDelete(id: number)
//   Use this.prisma.product.update({ where: { id }, data: { deletedAt: new Date() } })

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  // TODO: implement methods
}
