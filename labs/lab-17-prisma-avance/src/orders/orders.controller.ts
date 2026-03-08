import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';

// TODO: Decorate with @Controller('orders')
// TODO: Inject OrdersService via constructor

// TODO: POST /orders — create order with nested items
//   @Post()
//   create(@Body() dto: CreateOrderDto)
//   Return this.ordersService.createWithItems(dto)

// TODO: GET /orders — list all orders with items and products
//   @Get()
//   findAll()
//   Return this.ordersService.findAll()

// TODO: PATCH /orders/:id/cancel — cancel an order using transaction
//   @Patch(':id/cancel')
//   cancel(@Param('id', ParseIntPipe) id: number)
//   Return this.ordersService.cancelOrder(id)

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // TODO: implement endpoints
}
