import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { PublicKey } from "@solana/web3.js";
import { env } from "../config.js";
import { DEPOSIT_CAP_USDC } from "../constants.js";
import { marketState } from "../domain/guards.js";
import { costPreview } from "../services/quote.js";
import { buildDepositTx } from "../services/deposit.js";
import { buildWithdrawInKindTx, buildRequestSellTx } from "../services/withdraw.js";
import { sponsorAndSend, sponsorPubkey } from "../services/sponsor.js";
import { positionOf } from "../services/positions.js";
import { runEpochTurn } from "../services/crank.js";
import { universe } from "../services/universe.js";
import { fetchConfig, fetchEpoch } from "../solana/program.js";
import { repo } from "../db/repo.js";

const Profile = z.enum(["Steady", "Balanced", "Opportunistic"]);
const pk = z.string().transform((s, ctx) => { try { return new PublicKey(s); } catch { ctx.addIssue({ code: "custom", message: "bad pubkey" }); return z.NEVER; } });

export async function routes(app: FastifyInstance) {
  app.get("/health", async () => ({ ok: true, market: marketState(), sponsor: sponsorPubkey(), universe: Object.keys(universe()) }));

  app.get("/v1/universe", async () => ({ mints: Object.fromEntries(Object.entries(universe()).map(([t, v]) => [t, { mint: v.mint.toBase58(), decimals: v.decimals }])) }));

  app.get("/v1/quote", async (req) => {
    const q = z.object({ amount: z.coerce.number().positive().max(DEPOSIT_CAP_USDC), profile: Profile.default("Balanced"), tier: z.coerce.number().int().min(0).max(3).default(0) }).parse(req.query);
    return costPreview(q.amount, q.profile, q.tier);
  });

  app.post("/v1/tx/deposit", async (req) => {
    const b = z.object({ owner: pk, profile: Profile, amount: z.number().positive().max(DEPOSIT_CAP_USDC), mode: z.union([z.literal(0), z.literal(1)]).default(0), quizHash: z.array(z.number().int().min(0).max(255)).length(32).optional() }).parse(req.body);
    return buildDepositTx(b.owner, b.profile, b.amount, b.mode, b.quizHash ?? new Array(32).fill(0));
  });
  app.post("/v1/tx/withdraw-in-kind", async (req) => buildWithdrawInKindTx(z.object({ owner: pk }).parse(req.body).owner));
  app.post("/v1/tx/request-sell", async (req) => { const b = z.object({ owner: pk, assetIndex: z.number().int().min(0).max(9), shares: z.string() }).parse(req.body); return buildRequestSellTx(b.owner, b.assetIndex, BigInt(b.shares)); });

  app.post("/v1/tx/submit", async (req) => {
    const b = z.object({ tx: z.string(), owner: z.string(), kind: z.enum(["deposit", "withdraw-in-kind", "request-sell"]), amountUsdc: z.number().optional(), estimatedBps: z.number().optional() }).parse(req.body);
    const signature = await sponsorAndSend(b.tx, { owner: b.owner, kind: b.kind, amountUsdc: b.amountUsdc !== undefined ? BigInt(Math.round(b.amountUsdc * 1e6)) : undefined, estimatedBps: b.estimatedBps });
    return { signature, explorer: `https://solscan.io/tx/${signature}` };
  });

  app.get("/v1/positions/:owner", async (req) => positionOf(z.object({ owner: pk }).parse(req.params).owner) ?? { owner: (req.params as { owner: string }).owner, holdings: [], receipts: [] });

  app.get("/v1/epochs/current", async () => { const cfg = await fetchConfig(); const id = BigInt(cfg.currentEpoch.toString()); return { id: id.toString(), epoch: await fetchEpoch(id), fills: await repo.fillsForEpoch(id) }; });
  app.get("/v1/epochs/:id", async (req) => { const id = BigInt(z.object({ id: z.string() }).parse(req.params).id); return { id: id.toString(), epoch: await fetchEpoch(id), fills: await repo.fillsForEpoch(id) }; });

  // admin: manual crank turn, protected
  app.post("/v1/admin/crank", async (req, reply) => {
    if (!env.ADMIN_TOKEN || req.headers.authorization !== `Bearer ${env.ADMIN_TOKEN}`) return reply.code(401).send({ error: "unauthorized" });
    return runEpochTurn();
  });

  // Helius webhook receiver (indexer). Verified by the Authorization header you set in the Helius dashboard.
  app.post("/v1/webhooks/helius", async (req, reply) => {
    if (env.HELIUS_WEBHOOK_SECRET && req.headers.authorization !== env.HELIUS_WEBHOOK_SECRET) return reply.code(401).send({ error: "unauthorized" });
    app.log.info({ n: Array.isArray(req.body) ? (req.body as unknown[]).length : 1 }, "helius webhook");
    return { ok: true }; // decoding into fills/receipts is Sprint 3 (dividend ledger); fills are already recorded by the crank
  });
}
