import { Injectable } from '@nestjs/common';

@Injectable()
export class LoggerService {
  // TODO: Implement the log method
  // It should store the log message with a '[LOG]' prefix
  // Hint: You can use console.log and also store messages in an array for testing
  // Store messages in a public 'logs' array so tests can verify
  logs: string[] = [];

  // TODO: Implement log(message: string)
  // It should push '[LOG] message' to this.logs
  log(message: string): void {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement warn(message: string)
  // It should push '[WARN] message' to this.logs
  warn(message: string): void {
    throw new Error('TODO: Not implemented');
  }

  // TODO: Implement error(message: string)
  // It should push '[ERROR] message' to this.logs
  error(message: string): void {
    throw new Error('TODO: Not implemented');
  }
}
