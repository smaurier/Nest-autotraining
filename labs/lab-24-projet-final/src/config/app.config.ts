import { registerAs } from '@nestjs/config';

// TODO: Export a configuration using registerAs()
//   registerAs('app', () => ({
//     port: parseInt(process.env.PORT, 10) || 3000,
//     jwtSecret: process.env.JWT_SECRET || 'default-secret',
//     jwtExpiration: process.env.JWT_EXPIRATION || '1h',
//     nodeEnv: process.env.NODE_ENV || 'development',
//   }))

export default registerAs('app', () => ({
  // TODO: return configuration object
}));
