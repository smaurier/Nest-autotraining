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
  constructor(@InjectQueue('email') private emailQueue: Queue) {}

  async sendEmail(data: SendEmailDto) {
    const job = await this.emailQueue.add(data, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      removeOnComplete: true,
    });
    return { jobId: job.id, status: 'queued' };
  }

  async sendWelcomeEmail(to: string, username: string) {
    const job = await this.emailQueue.add(
      'welcome',
      { to, username },
      {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000,
        },
        removeOnComplete: true,
      },
    );
    return { jobId: job.id, status: 'queued' };
  }

  async getQueueStatus() {
    const [waiting, active, completed, failed] = await Promise.all([
      this.emailQueue.getWaitingCount(),
      this.emailQueue.getActiveCount(),
      this.emailQueue.getCompletedCount(),
      this.emailQueue.getFailedCount(),
    ]);
    return { waiting, active, completed, failed };
  }
}
