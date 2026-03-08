import { Injectable } from '@nestjs/common';

@Injectable()
export class DateService {
  // TODO: Implement now(): string
  // It should return the current date as an ISO string
  // Hint: return new Date().toISOString();
  now(): string {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement format(date: Date): string
  // It should return the date formatted as 'YYYY-MM-DD'
  // Hint: Use date.toISOString().split('T')[0]
  format(date: Date): string {
    throw new Error('TODO: Not implemented');
  }
}
