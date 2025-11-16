import { z } from "zod";

const Env = z.object({
  DATABASE_URL: z.string().url(),
  REPLIT_DOMAINS: z.string().min(1),
  REPL_ID: z.string().min(1),
  SESSION_SECRET: z.string().min(16),
  ADMIN_EMAILS: z.string().default(""),
  PORT: z.string().regex(/^\d+$/).transform(Number).default("5000"),
  TEST_AUTH: z.enum(["0","1"]).default("0"),
  FILES_DIR: z.string().default("files"),
  OPENAI_API_KEY: z.string().optional(),
  PAYPAL_CLIENT_ID: z.string().optional(),
  PAYPAL_CLIENT_SECRET: z.string().optional()
});

const parsed = Env.safeParse(process.env);
if (!parsed.success) {
  console.error("❌ Invalid environment:");
  console.error(parsed.error.format());
  process.exit(1);
}
console.log("✅ Environment OK");
