import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// TODO: Inject PrismaService via constructor

// TODO: async getCart(userId: number)
//   Find or create cart for user:
//     let cart = await this.prisma.cart.findUnique({
//       where: { userId },
//       include: { items: { include: { product: true } } },
//     });
//     if (!cart) {
//       cart = await this.prisma.cart.create({
//         data: { userId },
//         include: { items: { include: { product: true } } },
//       });
//     }
//     return cart;

// TODO: async addItem(userId: number, productId: number, quantity: number)
//   1. Get or create the cart
//   2. Check if item already exists in cart
//   3. If exists, update quantity. If not, create new cart item
//   4. Return updated cart

// TODO: removeItem(id: number)
//   return this.prisma.cartItem.delete({ where: { id } })

// TODO: async clearCart(userId: number)
//   Find cart, delete all items, return empty cart
//   await this.prisma.cartItem.deleteMany({ where: { cart: { userId } } })
//   return this.getCart(userId)

@Injectable()
export class CartService {
  constructor(private readonly prisma: PrismaService) {}

  // TODO: implement methods
}
