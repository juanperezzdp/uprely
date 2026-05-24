import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'test', 'production']);
const dodoEnvironmentSchema = z.enum(['test_mode', 'live_mode']);

export const envSchema = z.object({
  NODE_ENV: nodeEnvSchema.default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_HOST: z.string().min(1).default('127.0.0.1'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  REDIS_DB: z.coerce.number().int().nonnegative().default(0),
  REDIS_PASSWORD: z.string().default(''),
  CORS_ORIGINS: z.string().default('http://localhost:5173'),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
    .default('info'),
  SWAGGER_PATH: z.string().min(1).default('docs'),
  AUTH_COOKIE_NAME: z.string().min(1).default('auth_token'),
  AUTH_RATE_LIMIT_TTL_MS: z.coerce.number().int().positive().default(60000),
  AUTH_RATE_LIMIT_LIMIT: z.coerce.number().int().positive().default(10),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must have at least 32 characters'),
  JWT_EXPIRES_IN: z.string().min(1).default('7d'),
  DODO_PAYMENTS_API_KEY: z.string().min(1, 'DODO_PAYMENTS_API_KEY is required'),
  DODO_PAYMENTS_ENVIRONMENT: dodoEnvironmentSchema.default('test_mode'),
  DODO_PAYMENTS_WEBHOOK_KEY: z
    .string()
    .min(1, 'DODO_PAYMENTS_WEBHOOK_KEY is required'),
  DODO_PAYMENTS_PRO_PRODUCT_ID: z
    .string()
    .min(1, 'DODO_PAYMENTS_PRO_PRODUCT_ID is required'),
  DODO_PAYMENTS_RETURN_URL: z
    .string()
    .url('DODO_PAYMENTS_RETURN_URL must be a valid URL'),
});

export type EnvironmentVariables = z.infer<typeof envSchema>;

export function validateEnvironment(
  config: Record<string, unknown>,
): EnvironmentVariables {
  return envSchema.parse(config);
}

export function parseCorsOrigins(corsOrigins: string): string[] {
  return corsOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}
