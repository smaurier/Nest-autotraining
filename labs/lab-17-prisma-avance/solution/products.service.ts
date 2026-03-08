import { Injectable } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    name: string;
    price: number;
    stock?: number;
    categoryId?: number;
  }) {
    return this.prisma.product.create({ data });
  }

  async findWithCursorPagination(cursor?: number, take: number = 10) {
    const args: any = {
      take,
      orderBy: { id: 'asc' as const },
      include: { category: true },
    };

    if (cursor) {
      args.skip = 1; // skip the cursor item itself
      args.cursor = { id: cursor };
    }

    const products = await this.prisma.product.findMany(args);

    return {
      data: products,
      nextCursor:
        products.length === take
          ? products[products.length - 1].id
          : null,
    };
  }

  softDelete(id: number) {
    return this.prisma.product.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }
}
