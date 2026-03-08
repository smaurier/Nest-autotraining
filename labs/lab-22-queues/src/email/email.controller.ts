import { Controller, Post, Get, Body } from '@nestjs/common';
import { EmailService, SendEmailDto } from './email.service';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  // TODO: Implement POST /email/send
  // It should accept a SendEmailDto body and call emailService.sendEmail
  // Return the result (jobId and status)
  //
  // Hint:
  //   @Post('send')
  //   async sendEmail(@Body() dto: SendEmailDto) {
  //     return this.emailService.sendEmail(dto);
  //   }
  @Post('send')
  async sendEmail(@Body() dto: SendEmailDto) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement POST /email/welcome
  // It should accept { to, username } and call emailService.sendWelcomeEmail
  @Post('welcome')
  async sendWelcome(@Body() body: { to: string; username: string }) {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement GET /email/status
  // It should return the queue status
  @Get('status')
  async getStatus() {
    throw new Error('TODO: Not implemented');
  }
}
