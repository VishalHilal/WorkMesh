import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(16, 'JWT_ACCESS_SECRET must be at least 16 characters')
    .default('workmesh_dev_jwt_access_secret_32chars_long!'),
  JWT_ACCESS_EXPIRES_IN: z.string().default('15m'),

  // Neon Object Storage
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_ENDPOINT_URL_S3: z.string().optional(),
  AWS_REGION: z.string().default('us-east-2'),
  NEON_STORAGE_BUCKET: z.string().default('assets'),

  // Neon AI Gateway
  NEON_AI_GATEWAY_TOKEN: z.string().optional(),
  NEON_AI_GATEWAY_BASE_URL: z.string().optional(),

  // Neon Functions
  NEON_FUNCTION_HELLO_URL: z.string().optional(),

  // AI Service
  AI_SERVICE_URL: z.string().default('http://localhost:8000'),
  INTERNAL_API_KEY: z.string().default('workmesh-internal-secret-2026-prod-xyz'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors)
  process.exit(1)
}

export const env = parsed.data
