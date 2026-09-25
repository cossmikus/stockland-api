import { pgTable, text, bigint, integer, timestamp, boolean, serial, numeric } from "drizzle-orm/pg-core";

/** History the chain does not hand back cheaply: fills (for realized cost) and receipts. */
export const epochs = pgTable("epochs", {
  id: bigint("id", { mode: "bigint" }).primaryKey(),
  status: integer("status").notNull(),
  openedAt: timestamp("opened_at"), executedAt: timestamp("executed_at"), settledAt: timestamp("settled_at"),
  totalDepositsUsdc: bigint("total_deposits_usdc", { mode: "bigint" }).default(0n),
});
export const fills = pgTable("fills", {
  id: serial("id").primaryKey(),
  epochId: bigint("epoch_id", { mode: "bigint" }).notNull(),
  mint: text("mint").notNull(), ticker: text("ticker"), side: integer("side").notNull(),
  usdc: bigint("usdc", { mode: "bigint" }).notNull(), tokens: bigint("tokens", { mode: "bigint" }).notNull(),
  quotedImpactBps: numeric("quoted_impact_bps"), route: text("route"), signature: text("signature").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});
export const submissions = pgTable("submissions", {
  id: serial("id").primaryKey(), owner: text("owner").notNull(), kind: text("kind").notNull(), signature: text("signature").notNull(),
  amountUsdc: bigint("amount_usdc", { mode: "bigint" }), estimatedBps: integer("estimated_bps"), epochId: bigint("epoch_id", { mode: "bigint" }),
  createdAt: timestamp("created_at").defaultNow(),
});
export const universe = pgTable("universe", {
  ticker: text("ticker").primaryKey(), mint: text("mint").notNull(), decimals: integer("decimals").notNull(), locked: boolean("locked").notNull().default(true), roundTripBps1k: integer("round_trip_bps_1k"), testedAt: timestamp("tested_at"),
});
