import { Module } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { DateService } from './date.service';

@Module({
  providers: [LoggerService, DateService],
  exports: [LoggerService, DateService],
})
export class SharedModule {}
