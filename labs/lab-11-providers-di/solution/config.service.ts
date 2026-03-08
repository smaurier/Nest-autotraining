import { Injectable } from '@nestjs/common';

export const CONFIG_OPTIONS = 'CONFIG_OPTIONS';

@Injectable()
export class ConfigService {
  private readonly config: Record<string, any>;

  constructor(config: Record<string, any>) {
    this.config = config;
  }

  get(key: string): any {
    return this.config[key];
  }
}
