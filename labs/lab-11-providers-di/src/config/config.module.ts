import { Module, DynamicModule, Global } from '@nestjs/common';
import { ConfigService, CONFIG_OPTIONS } from './config.service';

@Global()
@Module({})
export class ConfigModule {
  static forRoot(options: Record<string, any>): DynamicModule {
    return {
      module: ConfigModule,
      providers: [
        {
          provide: CONFIG_OPTIONS,
          useValue: options,
        },
        {
          provide: ConfigService,
          useFactory: (config: Record<string, any>) => {
            return new ConfigService(config);
          },
          inject: [CONFIG_OPTIONS],
        },
      ],
      exports: [ConfigService],
    };
  }
}
