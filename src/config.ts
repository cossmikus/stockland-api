import "dotenv/config";
import { z } from "zod";

// Secrets and deployment knobs only. Everything that tunes behaviour is in constants.ts.
const Env = z.object({
  HELIUS_API_KEY: z.string().min(10),
  SOLANA_CLUSTER: z.enum(["devnet", "mainnet-beta"]).default("devnet"),
  CRANK_SECRET: z.string().min(40),
  SPONSOR_SECRET: z.string().min(40),
  PROGRAM_ID: z.string().min(32),
  DATABASE_URL: z.string().optional().default(""),
  ADMIN_TOKEN: z.string().optional().default(""),
  HELIUS_WEBHOOK_SECRET: z.string().optional().default(""),
  PORT: z.coerce.number().default(8787),
  CORS_ORIGIN: z.string().default("http://localhost:3000"),
  CRANK_ENABLED: z.enum(["true", "false"]).default("false"),
});
const parsed = Env.safeParse(process.env);
if (!parsed.success) { console.error("Invalid environment:", parsed.error.flatten().fieldErrors); process.exit(1); }
export const env = parsed.data;
export const isMainnet = env.SOLANA_CLUSTER === "mainnet-beta";
export const rpcUrl = `https://${isMainnet ? "mainnet" : "devnet"}.helius-rpc.com/?api-key=${env.HELIUS_API_KEY}`;
