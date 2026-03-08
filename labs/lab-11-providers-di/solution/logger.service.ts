import { Injectable } from '@nestjs/common';

@Injectable()
export class LoggerService {
  logs: string[] = [];

  log(message: string): void {
    const entry = `[LOG] ${message}`;
    this.logs.push(entry);
    console.log(entry);
  }

  warn(message: string): void {
    const entry = `[WARN] ${message}`;
    this.logs.push(entry);
    console.warn(entry);
  }

  error(message: string): void {
    const entry = `[ERROR] ${message}`;
    this.logs.push(entry);
    console.error(entry);
  }
}
