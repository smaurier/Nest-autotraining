import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from './prisma.service';
import { CreateOrderDto } from '../src/orders/dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  createWithItems(dto: CreateOrderDto) {
    const total = dto.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    return this.prisma.order.create({
      data: {
        total,
        items: {
          create: dto.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            price: item.price,
          })),
        },
      },
      include: { items: { include: { product: true } } },
    });
  }

  findAll() {
    return this.prisma.order.findMany({
      include: { items: { include: { product: true } } },
    });
  }

  cancelOrder(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id } });

      if (!order) {
        throw new BadRequestException('Order not found');
      }
      if (order.status === 'cancelled') {
        throw new BadRequestException('Order already cancelled');
      }
      if (order.status !== 'pending') {
        throw new BadRequestException(
          'Only pending orders can be cancelled',
        );
      }

      return tx.order.update({
        where: { id },
        data: { status: 'cancelled' },
        include: { items: { include: { product: true } } },
      });
    });
  }
}
