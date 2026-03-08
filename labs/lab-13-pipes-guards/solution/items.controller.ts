import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  UseGuards,
  UseInterceptors,
  UseFilters,
} from '@nestjs/common';
import { ItemsService } from './items.service';
import { ParsePositiveIntPipe } from '../common/pipes/parse-positive-int.pipe';
import { AuthGuard } from '../common/guards/auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { LoggingInterceptor } from '../common/interceptors/logging.interceptor';
import { TransformInterceptor } from '../common/interceptors/transform.interceptor';
import { HttpExceptionFilter } from '../common/filters/http-exception.filter';

@Controller('items')
@UseInterceptors(LoggingInterceptor, TransformInterceptor)
@UseFilters(HttpExceptionFilter)
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  @Get()
  findAll() {
    return this.itemsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.itemsService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard)
  create(@Body() body: { name: string; description?: string }) {
    return this.itemsService.create(body);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  update(
    @Param('id', ParsePositiveIntPipe) id: number,
    @Body() body: Partial<{ name: string; description: string }>,
  ) {
    return this.itemsService.update(id, body);
  }

  @Delete(':id')
  @UseGuards(AuthGuard, RolesGuard)
  @Roles('admin')
  remove(@Param('id', ParsePositiveIntPipe) id: number) {
    return this.itemsService.remove(id);
  }
}
