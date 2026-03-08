import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { CartService } from './cart.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

// TODO: Decorate with @ApiTags('cart'), @ApiBearerAuth(), @UseGuards(JwtAuthGuard), @Controller('cart')

// TODO: GET /cart — get current user's cart
//   @Get()
//   getCart(@Request() req)
//   Return this.cartService.getCart(req.user.id)

// TODO: POST /cart/items — add item to cart
//   @Post('items')
//   addItem(@Request() req, @Body() data: { productId: number; quantity: number })
//   Return this.cartService.addItem(req.user.id, data.productId, data.quantity)

// TODO: DELETE /cart/items/:id — remove item from cart
//   @Delete('items/:id')
//   removeItem(@Param('id', ParseIntPipe) id: number)
//   Return this.cartService.removeItem(id)

// TODO: DELETE /cart — clear cart
//   @Delete()
//   clearCart(@Request() req)
//   Return this.cartService.clearCart(req.user.id)

@ApiTags('cart')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  // TODO: implement endpoints
}
