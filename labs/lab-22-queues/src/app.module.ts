import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { ScheduleModule } from '@nestjs/schedule';
import { EmailModule } from './email/email.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT, 10) || 6379,
      },
    }),
    ScheduleModule.forRoot(),
    EmailModule,
    TasksModule,
  ],
})
export class AppModule {}
