import { Injectable } from '@nestjs/common';

@Injectable()
export class LoggerService {
  // TODO: Implement log(context: string, message: string): string
  // It should return a formatted string: `[${context}] ${message}`
  // Hint: Also console.log the message for debugging
  log(context: string, message: string): string {
    throw new Error('TODO: Not implemented');
  }
}
