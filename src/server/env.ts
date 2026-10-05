import "server-only";
import { z } from "zod";

const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).optional(),
    APP_MODE: z.enum(["skeleton", "live"]).default("skeleton"),
    DATABASE_URL: z.string().min(1).optional(),
    SESSION_SECRET: z.string().min(32).optional(),
  });

export type ServerEnv = z.infer<typeof serverEnvSchema>;

export function loadServerEnv(values: Record<string, string | undefined>): ServerEnv {
  return serverEnvSchema.parse(values);
}
