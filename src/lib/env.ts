import { z } from "zod";

type EnvInput = Record<string, string | undefined>;

const publicEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1)
});

const serverEnvSchema = publicEnvSchema.extend({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  BOOTSTRAP_OWNER_EMAIL: z.string().email().optional(),
  BUSINESS_TIMEZONE: z.string().default("America/Chicago"),
  DEFAULT_CURRENCY: z.string().length(3).default("USD"),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info")
});

export type PublicEnv = z.infer<typeof publicEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function getPublicEnv(env: EnvInput = process.env): PublicEnv {
  return publicEnvSchema.parse(env);
}

export function getServerEnv(env: EnvInput = process.env): ServerEnv {
  return serverEnvSchema.parse(env);
}
