import { Module, DynamicModule, Global } from '@nestjs/common';

export const DATABASE_CONFIG = 'DATABASE_CONFIG';

export interface DatabaseConfig {
  type: string;
  host?: string;
  port?: number;
}

@Global()
@Module({})
export class DatabaseModule {
  static forRoot(config: DatabaseConfig): DynamicModule {
    return {
      module: DatabaseModule,
      providers: [
        {
          provide: DATABASE_CONFIG,
          useValue: config,
        },
      ],
      exports: [DATABASE_CONFIG],
    };
  }
}
