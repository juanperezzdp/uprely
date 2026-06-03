import { z } from 'zod'

const envSchema = z.object({
  VITE_API_BASE_URL: z
    .string()
    .trim()
    .min(1)
    .default('/api'),
  VITE_APP_NAME: z
    .string()
    .trim()
    .min(1)
    .default('UptimeWatch'),
})

const parsedEnvironment = envSchema.safeParse(import.meta.env)

if (!parsedEnvironment.success) {
  throw new Error(
    `Invalid environment variables: ${parsedEnvironment.error.message}`,
  )
}

export const env = parsedEnvironment.data
