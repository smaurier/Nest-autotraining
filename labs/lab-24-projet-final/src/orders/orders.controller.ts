import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

// TODO: Decorate with @ApiTags('orders'), @ApiBearerAuth(), @UseGuards(JwtAuthGuard), @Controller('orders')

// TODO: POST /orders — create a new order
//   @Post()
//   create(@Request() req, @Body() dto: CreateOrderDto)
//   Return this.ordersService.create(req.user.id, dto)

// TODO: GET /orders — list user's orders (or all orders for admin)
//   @Get()
//   findAll(@Request() req)
//   If req.user.role === 'admin', return all orders
//   Otherwise return only user's orders: this.ordersService.findByUser(req.user.id)

// TODO: GET /orders/:id — get a single order
//   @Get(':id')
//   findOne(@Param('id', ParseIntPipe) id: number)
//   Return this.ordersService.findOne(id)

// TODO: PATCH /orders/:id/status — update order status (admin only)
//   @UseGuards(RolesGuard)
//   @Roles('admin')
//   @Patch(':id/status')
//   updateStatus(@Param('id', ParseIntPipe) id: number, @Body('status') status: string)
//   Return this.ordersService.updateStatus(id, status)

@ApiTags('orders')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // TODO: implement endpoints
}
