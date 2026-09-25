import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { env } from "../config.js";
import * as schema from "./schema.js";

/** Optional. Every caller must handle `db === null` (receipts skipped, money path unaffected). */
export const db = env.DATABASE_URL ? drizzle(postgres(env.DATABASE_URL, { max: 5 }), { schema }) : null;
