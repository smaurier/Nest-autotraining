import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  port: parseInt(process.env.PORT, 10) || 3000,
  name: process.env.APP_NAME || 'NestJS App',
  nodeEnv: process.env.NODE_ENV || 'development',
}));
