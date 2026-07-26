import * as Joi from 'joi';

export const validationSchema = Joi.object({
  PORT: Joi.number().default(3100),
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  MONGO_URI: Joi.string().required(),
  GOOGLE_CLIENT_ID: Joi.string().required(),
  ADMIN_EMAILS: Joi.string().required(),
  ADMIN_PORTAL_ORIGIN: Joi.string().uri().required(),
  SESSION_SECRET: Joi.string().min(32).required(),
  SESSION_TTL: Joi.number().integer().min(300).default(3600),
  COOKIE_SECURE: Joi.boolean().default(false),
  COOKIE_SAME_SITE: Joi.string().valid('lax', 'strict', 'none').default('lax'),
});
