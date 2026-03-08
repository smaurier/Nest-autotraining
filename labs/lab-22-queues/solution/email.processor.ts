import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  @Process()
  async handleSendEmail(job: Job) {
    const { to, subject, body } = job.data;
    this.logger.log(`Sending email to ${to}: ${subject}`);

    // Simulate email sending delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    this.logger.log(`Email sent to ${to}`);
    return { sent: true, to, subject };
  }

  @Process('welcome')
  async handleWelcomeEmail(job: Job) {
    const { to, username } = job.data;
    this.logger.log(`Sending welcome email to ${to} for user ${username}`);

    // Simulate email sending delay
    await new Promise((resolve) => setTimeout(resolve, 100));

    this.logger.log(`Welcome email sent to ${to}`);
    return { sent: true, to, type: 'welcome' };
  }

  @OnQueueActive()
  onActive(job: Job) {
    this.logger.log(`Processing job ${job.id} of type ${job.name}...`);
  }

  @OnQueueCompleted()
  onCompleted(job: Job, result: any) {
    this.logger.log(`Job ${job.id} completed with result: ${JSON.stringify(result)}`);
  }

  @OnQueueFailed()
  onFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`, error.stack);
  }
}
