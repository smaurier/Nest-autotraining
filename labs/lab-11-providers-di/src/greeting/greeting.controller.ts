import { Controller, Get, Param } from '@nestjs/common';
import { GreetingService } from './greeting.service';

@Controller('greeting')
export class GreetingController {
  constructor(private readonly greetingService: GreetingService) {}

  // TODO: Implement GET /greeting/:name
  // It should call this.greetingService.greet(name)
  // Hint: Use @Get(':name') and @Param('name')
  greet(name: string) {
    throw new Error('TODO: Not implemented');
  }
}
