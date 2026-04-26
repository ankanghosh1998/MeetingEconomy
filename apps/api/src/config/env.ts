import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().default("postgresql://postgres:postgres@localhost:5432/meetingeconomy?schema=public"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_SECRET: z.string().default("dev-secret-change-me"),
  ENCRYPTION_KEY: z.string().optional(),
  API_PORT: z.coerce.number().default(4000),
  API_URL: z.string().url().default("http://localhost:4000"),
  WEB_URL: z.string().url().default("http://localhost:3000"),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  READINESS_CHECK_REDIS: z.coerce.boolean().default(false),
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  GOOGLE_CALENDAR_REDIRECT_URI: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_TENANT_ID: z.string().default("common"),
  MICROSOFT_REDIRECT_URI: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().optional(),
  SENDGRID_API_KEY: z.string().optional(),
  SENDGRID_FROM_EMAIL: z.string().email().default("reports@meetingeconomy.io"),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SENTRY_DSN: z.string().optional()
});

export const env = envSchema.parse(process.env);

export function isConfigured(value?: string | null) {
  return Boolean(value && value.trim() !== "" && value.trim() !== "<UNSPECIFIED>");
}

export const isProduction = env.NODE_ENV === "production";

if (isProduction && (!isConfigured(env.JWT_SECRET) || env.JWT_SECRET === "dev-secret-change-me")) {
  throw new Error("JWT_SECRET must be configured in production.");
}

if (isProduction && !isConfigured(env.ENCRYPTION_KEY)) {
  throw new Error("ENCRYPTION_KEY must be configured in production.");
}
