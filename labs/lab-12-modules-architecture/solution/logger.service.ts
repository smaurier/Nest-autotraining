import { Injectable } from '@nestjs/common';

@Injectable()
export class LoggerService {
  log(context: string, message: string): string {
    const formatted = `[${context}] ${message}`;
    console.log(formatted);
    return formatted;
  }
}
