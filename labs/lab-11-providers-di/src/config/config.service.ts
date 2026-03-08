import { Injectable, Inject } from '@nestjs/common';

export const CONFIG_OPTIONS = 'CONFIG_OPTIONS';

@Injectable()
export class ConfigService {
  // TODO: Store the config object passed to the constructor
  // The constructor receives the config Record<string, any> from the factory provider
  // Hint: constructor(private readonly config: Record<string, any>) {}

  constructor(config: Record<string, any>) {
    // TODO: Store config
    // Hint: this.config = config;
  }

  // TODO: Implement get(key: string): any
  // It should return the value for the given key from the config object
  // Return undefined if key is not found
  get(key: string): any {
    throw new Error('TODO: Not implemented');
  }
}
