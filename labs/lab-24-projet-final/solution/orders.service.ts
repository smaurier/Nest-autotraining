import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotificationsGateway } from './notifications.gateway';
import { CreateOrderDto } from '../src/orders/dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  async create(userId: number, dto: CreateOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      let total = 0;
      const itemsData = [];

      for (const item of dto.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId },
        });

        if (!product) {
          throw new BadRequestException(
            `Product #${item.productId} not found`,
          );
        }

        if (product.stock < item.quantity) {
          throw new BadRequestException(
            `Insufficient stock for product ${product.name}`,
          );
        }

        // Update stock
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });

        total += product.price * item.quantity;
        itemsData.push({
          productId: item.productId,
          quantity: item.quantity,
          price: product.price,
        });
      }

      const order = await tx.order.create({
        data: {
          userId,
          total,
          items: { create: itemsData },
        },
        include: { items: { include: { product: true } } },
      });

      this.notificationsGateway.notifyOrderCreated(order);
      return order;
    });
  }

  findAll() {
    return this.prisma.order.findMany({
      include: { items: { include: { product: true } }, user: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByUser(userId: number) {
    return this.prisma.order.findMany({
      where: { userId },
      include: { items: { include: { product: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: number) {
    const order = await this.prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        user: true,
      },
    });
    if (!order) {
      throw new NotFoundException(`Order #${id} not found`);
    }
    return order;
  }

  async updateStatus(id: number, status: string) {
    const order = await this.prisma.order.update({
      where: { id },
      data: { status },
      include: { items: { include: { product: true } } },
    });

    this.notificationsGateway.notifyOrderStatusChanged(order);
    return order;
  }
}
