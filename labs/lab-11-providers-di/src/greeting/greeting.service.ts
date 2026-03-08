import { Injectable } from '@nestjs/common';
import { LoggerService } from '../logger/logger.service';
import { ConfigService } from '../config/config.service';

@Injectable()
export class GreetingService {
  // TODO: Inject LoggerService and ConfigService via constructor
  // Hint: constructor(
  //   private readonly logger: LoggerService,
  //   private readonly config: ConfigService,
  // ) {}

  constructor() {
    // TODO: Add the injected dependencies as constructor parameters
  }

  // TODO: Implement greet(name: string): { message: string }
  // It should:
  // 1. Get the prefix from config using this.config.get('greeting.prefix') (default: 'Hello')
  // 2. Log the greeting using this.logger.log(...)
  // 3. Return { message: `${prefix}, ${name}!` }
  greet(name: string): { message: string } {
    throw new Error('TODO: Not implemented');
  }
}
