import { registerAs } from '@nestjs/config';

// TODO: Implement the app config namespace
// It should use registerAs('app', () => ({ ... })) to create a typed config namespace
// Return an object with:
//   port: parseInt(process.env.PORT, 10) || 3000
//   name: process.env.APP_NAME || 'NestJS App'
//   nodeEnv: process.env.NODE_ENV || 'development'
//
// Hint:
//   export default registerAs('app', () => ({
//     port: parseInt(process.env.PORT, 10) || 3000,
//     name: process.env.APP_NAME || 'NestJS App',
//     nodeEnv: process.env.NODE_ENV || 'development',
//   }));

export default registerAs('app', () => {
  throw new Error('TODO: Not implemented');
});
