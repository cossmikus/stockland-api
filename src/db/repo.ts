import { eq } from "drizzle-orm";
import { db } from "./client.js";
import { epochs, fills, submissions } from "./schema.js";

export const repo = {
  async upsertEpoch(id: bigint, status: number, patch: Partial<{ openedAt: Date; executedAt: Date; settledAt: Date; totalDepositsUsdc: bigint }> = {}) {
    if (!db) return; await db.insert(epochs).values({ id, status, ...patch }).onConflictDoUpdate({ target: epochs.id, set: { status, ...patch } });
  },
  async addFill(f: typeof fills.$inferInsert) { if (db) await db.insert(fills).values(f); },
  async addSubmission(s: typeof submissions.$inferInsert) { if (db) await db.insert(submissions).values(s); },
  async fillsForEpoch(id: bigint) { return db ? db.select().from(fills).where(eq(fills.epochId, id)) : []; },
  async submissionsFor(owner: string) { return db ? db.select().from(submissions).where(eq(submissions.owner, owner)) : []; },
};
