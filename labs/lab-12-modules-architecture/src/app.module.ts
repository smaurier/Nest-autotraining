import { Module } from '@nestjs/common';
import { SharedModule } from './shared/shared.module';
import { UsersModule } from './users/users.module';
import { ProductsModule } from './products/products.module';
import { DatabaseModule } from './database/database.module';

@Module({
  imports: [
    SharedModule,
    DatabaseModule.forRoot({ type: 'memory' }),
    UsersModule,
    ProductsModule,
  ],
})
export class AppModule {}
