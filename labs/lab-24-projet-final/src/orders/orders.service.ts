import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsGateway } from '../notifications/notifications.gateway';
import { CreateOrderDto } from './dto/create-order.dto';

// TODO: Inject PrismaService and NotificationsGateway via constructor

// TODO: async create(userId: number, dto: CreateOrderDto)
//   Use an interactive $transaction:
//     1. For each item in dto.items, find the product and check stock
//     2. Calculate total from product prices * quantities
//     3. Update stock for each product (decrement by quantity)
//     4. Create the order with nested items using product price
//     5. Notify via WebSocket: this.notificationsGateway.notifyOrderCreated(order)
//     6. Return the order

// TODO: findAll()
//   return this.prisma.order.findMany({
//     include: { items: { include: { product: true } }, user: true },
//     orderBy: { createdAt: 'desc' },
//   })

// TODO: findByUser(userId: number)
//   return this.prisma.order.findMany({
//     where: { userId },
//     include: { items: { include: { product: true } } },
//     orderBy: { createdAt: 'desc' },
//   })

// TODO: async findOne(id: number)
//   Find order with items, products, and user included
//   If not found, throw NotFoundException
//   Return order

// TODO: async updateStatus(id: number, status: string)
//   Update order status
//   Notify via WebSocket: this.notificationsGateway.notifyOrderStatusChanged(order)
//   Return updated order

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  // TODO: implement methods
}
