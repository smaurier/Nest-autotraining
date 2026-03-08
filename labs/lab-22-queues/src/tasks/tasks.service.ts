import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression, Interval } from '@nestjs/schedule';

@Injectable()
export class TasksService {
  private readonly logger = new Logger(TasksService.name);

  // TODO: Implement a cron job for daily cleanup
  // It should run every day at midnight
  // Use @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT) or @Cron('0 0 * * *')
  // Log a message indicating cleanup is running
  //
  // Hint:
  //   @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  //   handleCleanup() {
  //     this.logger.log('Running daily cleanup...');
  //     // In production: clean old jobs, expired sessions, etc.
  //   }
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  handleCleanup() {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement an interval job for health check
  // It should run every 30 seconds
  // Use @Interval(30000)
  // Log a message indicating the health check
  //
  // Hint:
  //   @Interval(30000)
  //   handleHealthCheck() {
  //     this.logger.log('Health check: application is running');
  //   }
  @Interval(30000)
  handleHealthCheck() {
    throw new Error('TODO: Not implemented');
  }
}
