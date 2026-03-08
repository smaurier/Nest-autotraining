import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../src/prisma/prisma.service';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async cleanupAbandonedCarts() {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - 7); // 7 days ago

    const abandonedCarts = await this.prisma.cart.findMany({
      where: {
        updatedAt: { lt: threshold },
        items: { some: {} }, // Only carts that have items
      },
    });

    for (const cart of abandonedCarts) {
      await this.prisma.cartItem.deleteMany({
        where: { cartId: cart.id },
      });
    }

    this.logger.log(
      `Cleaned up ${abandonedCarts.length} abandoned cart(s)`,
    );
  }
}
