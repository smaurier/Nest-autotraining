import { Injectable } from '@nestjs/common';
import { PrismaService } from '../src/prisma/prisma.service';

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  async getCart(userId: number) {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: { items: { include: { product: true } } },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: { userId },
        include: { items: { include: { product: true } } },
      });
    }

    return cart;
  }

  async addItem(userId: number, productId: number, quantity: number) {
    const cart = await this.getCart(userId);

    const existingItem = cart.items.find(
      (item) => item.productId === productId,
    );

    if (existingItem) {
      await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + quantity },
      });
    } else {
      await this.prisma.cartItem.create({
        data: {
          cartId: cart.id,
          productId,
          quantity,
        },
      });
    }

    return this.getCart(userId);
  }

  removeItem(id: number) {
    return this.prisma.cartItem.delete({ where: { id } });
  }

  async clearCart(userId: number) {
    await this.prisma.cartItem.deleteMany({
      where: { cart: { userId } },
    });
    return this.getCart(userId);
  }
}
