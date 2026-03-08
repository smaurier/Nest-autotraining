import { Injectable } from '@nestjs/common';

@Injectable()
export class DateService {
  now(): string {
    return new Date().toISOString();
  }

  format(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
