import { Module } from '@nestjs/common';
import { LoggerModule } from './logger/logger.module';
import { ConfigModule } from './config/config.module';
import { GreetingModule } from './greeting/greeting.module';

@Module({
  imports: [
    LoggerModule,
    ConfigModule.forRoot({
      'greeting.prefix': 'Hello',
      'app.name': 'NestJS Lab 11',
    }),
    GreetingModule,
  ],
})
export class AppModule {}
