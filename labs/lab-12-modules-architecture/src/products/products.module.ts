import { Module } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module';
import { ProductsController } from './products.controller';
import { ProductsService } from './products.service';

// TODO: Complete the module decorator
// It should import SharedModule
// Hint: imports: [SharedModule]

@Module({
  controllers: [ProductsController],
  providers: [ProductsService],
})
export class ProductsModule {}
