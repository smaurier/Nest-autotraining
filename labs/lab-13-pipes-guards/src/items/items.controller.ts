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

// TODO: Apply the LoggingInterceptor and TransformInterceptor to the entire controller
// TODO: Apply the HttpExceptionFilter to the entire controller
// Hint: Use @UseInterceptors() and @UseFilters() at class level

@Controller('items')
export class ItemsController {
  constructor(private readonly itemsService: ItemsService) {}

  // TODO: Implement GET /items
  // No guard needed for this route
  findAll() {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement GET /items/:id
  // Use ParsePositiveIntPipe for the id parameter
  findOne(id: number) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement POST /items
  // Protect with @UseGuards(AuthGuard)
  create(body: { name: string; description?: string }) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement PATCH /items/:id
  // Protect with @UseGuards(AuthGuard)
  update(id: number, body: Partial<{ name: string; description: string }>) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement DELETE /items/:id
  // Protect with @UseGuards(AuthGuard, RolesGuard) and @Roles('admin')
  remove(id: number) {
    throw new Error('TODO: Not implemented');
  }
}
