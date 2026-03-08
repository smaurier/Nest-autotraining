import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

export interface SendEmailDto {
  to: string;
  subject: string;
  body: string;
}

@Injectable()
export class EmailService {
  // TODO: Inject the Bull queue
  // Hint: constructor(@InjectQueue('email') private emailQueue: Queue) {}

  // TODO: Implement sendEmail(data)
  // It should add a job to the email queue with options:
  //   attempts: 3 — retry up to 3 times
  //   backoff: { type: 'exponential', delay: 1000 } — exponential backoff
  //   removeOnComplete: true — clean up completed jobs
  //
  // Hint:
  //   async sendEmail(data: SendEmailDto) {
  //     const job = await this.emailQueue.add(data, {
  //       attempts: 3,
  //       backoff: { type: 'exponential', delay: 1000 },
  //       removeOnComplete: true,
  //     });
  //     return { jobId: job.id, status: 'queued' };
  //   }
  async sendEmail(data: SendEmailDto) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement sendWelcomeEmail(to, username)
  // It should add a named job 'welcome' to the queue
  // Hint: this.emailQueue.add('welcome', { to, username }, options)
  async sendWelcomeEmail(to: string, username: string) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement getQueueStatus()
  // It should return queue statistics
  // Hint:
  //   const [waiting, active, completed, failed] = await Promise.all([
  //     this.emailQueue.getWaitingCount(),
  //     this.emailQueue.getActiveCount(),
  //     this.emailQueue.getCompletedCount(),
  //     this.emailQueue.getFailedCount(),
  //   ]);
  //   return { waiting, active, completed, failed };
  async getQueueStatus() {
    throw new Error('TODO: Not implemented');
  }
}
