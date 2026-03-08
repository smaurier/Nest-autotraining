import * as Joi from 'joi';

export const validationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  JWT_SECRET: Joi.string().required(),
  APP_NAME: Joi.string().default('NestJS App'),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
});
