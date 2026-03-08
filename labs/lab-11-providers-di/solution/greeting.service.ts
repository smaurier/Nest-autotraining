import { Injectable } from '@nestjs/common';
import { LoggerService } from '../logger/logger.service';
import { ConfigService } from '../config/config.service';

@Injectable()
export class GreetingService {
  constructor(
    private readonly logger: LoggerService,
    private readonly config: ConfigService,
  ) {}

  greet(name: string): { message: string } {
    const prefix = this.config.get('greeting.prefix') || 'Hello';
    const message = `${prefix}, ${name}!`;
    this.logger.log(`Greeting: ${message}`);
    return { message };
  }
}
