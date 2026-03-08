import { Module } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { DateService } from './date.service';

// TODO: Create the SharedModule
// It should:
// 1. Declare LoggerService and DateService as providers
// 2. Export both services so other modules can use them
// Hint: Use the @Module decorator with providers and exports arrays

@Module({})
export class SharedModule {}
