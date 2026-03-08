import { registerAs } from '@nestjs/config';

// TODO: Implement the database config namespace
// It should use registerAs('database', () => ({ ... }))
// Return an object with:
//   url: process.env.DATABASE_URL
//
// Hint:
//   export default registerAs('database', () => ({
//     url: process.env.DATABASE_URL,
//   }));

export default registerAs('database', () => {
  throw new Error('TODO: Not implemented');
});
