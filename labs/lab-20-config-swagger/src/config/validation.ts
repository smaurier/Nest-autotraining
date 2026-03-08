import * as Joi from 'joi';

// TODO: Implement the Joi validation schema for environment variables
// It should validate:
//   PORT: Joi.number().default(3000)
//   DATABASE_URL: Joi.string().required()
//   JWT_SECRET: Joi.string().required()
//   APP_NAME: Joi.string().default('NestJS App')
//   NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development')
//
// Hint:
//   export const validationSchema = Joi.object({
//     PORT: Joi.number().default(3000),
//     ...
//   });

export const validationSchema = Joi.object({
  // TODO: Add validation rules here
  // Hint: PORT: Joi.number().default(3000),
});
