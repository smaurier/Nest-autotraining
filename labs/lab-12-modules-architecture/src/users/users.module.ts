import { Module } from '@nestjs/common';
import { SharedModule } from '../shared/shared.module';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

// TODO: Complete the module decorator
// It should import SharedModule so that LoggerService and DateService are available
// Hint: imports: [SharedModule]

@Module({
  controllers: [UsersController],
  providers: [UsersService],
})
export class UsersModule {}
