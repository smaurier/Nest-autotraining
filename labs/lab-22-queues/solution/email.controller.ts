import { Controller, Post, Get, Body } from '@nestjs/common';
import { EmailService, SendEmailDto } from '../src/email/email.service';

@Controller('email')
export class EmailController {
  constructor(private readonly emailService: EmailService) {}

  @Post('send')
  async sendEmail(@Body() dto: SendEmailDto) {
    return this.emailService.sendEmail(dto);
  }

  @Post('welcome')
  async sendWelcome(@Body() body: { to: string; username: string }) {
    return this.emailService.sendWelcomeEmail(body.to, body.username);
  }

  @Get('status')
  async getStatus() {
    return this.emailService.getQueueStatus();
  }
}
