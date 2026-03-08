import {
  Processor,
  Process,
  OnQueueActive,
  OnQueueCompleted,
  OnQueueFailed,
} from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

// TODO: Implement the EmailProcessor
// It should be decorated with @Processor('email') to process jobs from the 'email' queue

// TODO: Implement the default @Process() handler
// It should:
// 1. Extract the email data from job.data (to, subject, body)
// 2. Simulate sending an email (log the data)
// 3. Return a result object { sent: true, to, subject }
//
// Hint:
//   @Process()
//   async handleSendEmail(job: Job) {
//     const { to, subject, body } = job.data;
//     this.logger.log(`Sending email to ${to}: ${subject}`);
//     // Simulate email sending delay
//     await new Promise(resolve => setTimeout(resolve, 100));
//     return { sent: true, to, subject };
//   }

// TODO: Implement @Process('welcome') for welcome emails
// It should handle a specific job type 'welcome'
// Hint: Similar to above but with a specific template

// TODO: Implement @OnQueueFailed handler
// It should log the error when a job fails
// Hint:
//   @OnQueueFailed()
//   handleFailed(job: Job, error: Error) {
//     this.logger.error(`Job ${job.id} failed: ${error.message}`);
//   }

@Processor('email')
export class EmailProcessor {
  private readonly logger = new Logger(EmailProcessor.name);

  @Process()
  async handleSendEmail(job: Job) {
    throw new Error('TODO: Not implemented');
  }

  @Process('welcome')
  async handleWelcomeEmail(job: Job) {
    throw new Error('TODO: Not implemented');
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
    throw new Error('TODO: Not implemented');
  }
}
