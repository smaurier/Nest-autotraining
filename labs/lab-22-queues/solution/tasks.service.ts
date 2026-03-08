import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  handleCleanup() {
    this.logger.log('Running daily cleanup...');
    // In production: clean old jobs, expired sessions, temp files, etc.
    this.logger.log('Daily cleanup completed');
  }

  @Interval(30000)
  handleHealthCheck() {
    this.logger.log('Health check: application is running');
  }
}
