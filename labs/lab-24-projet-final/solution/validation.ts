import * as Joi from 'joi';

export const validationSchema = Joi.object({
  PORT: Joi.number().default(3000),
  JWT_SECRET: Joi.string().required(),
  JWT_EXPIRATION: Joi.string().default('1h'),
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
});
