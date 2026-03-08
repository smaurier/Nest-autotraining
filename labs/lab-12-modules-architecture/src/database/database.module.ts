import { Module, DynamicModule, Global } from '@nestjs/common';

export const DATABASE_CONFIG = 'DATABASE_CONFIG';

export interface DatabaseConfig {
  type: string;
  host?: string;
  port?: number;
}

// TODO: Create a dynamic module with a static forRoot method
// It should:
// 1. Be a @Global() module
// 2. Have a static forRoot(config: DatabaseConfig): DynamicModule method
// 3. Provide the config using the DATABASE_CONFIG token (useValue)
// 4. Export the DATABASE_CONFIG token
// Hint:
// static forRoot(config: DatabaseConfig): DynamicModule {
//   return {
//     module: DatabaseModule,
//     providers: [{ provide: DATABASE_CONFIG, useValue: config }],
//     exports: [DATABASE_CONFIG],
//   };
// }

@Global()
@Module({})
export class DatabaseModule {
  static forRoot(config: DatabaseConfig): DynamicModule {
    // TODO: Implement forRoot
    // Hint: Return a DynamicModule object
    throw new Error('TODO: Not implemented');
  }
}
