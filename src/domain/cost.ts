import { BASIS_BPS_PLACEHOLDER, FEE_BPS_BY_TIER } from "../constants.js";

export type LegQuote = { ticker: string; usd: number; impactBps: number | null; note?: string };
export type CostEstimate = { amount: number; routing: number; fee: number; feeBps: number; basis: number; total: number; bps: number; legs: LegQuote[] };

/** Radical cost honesty (A3): estimated all-in cost from real per-leg impact. Pure. */
export function estimate(amount: number, legs: LegQuote[], tier = 0): CostEstimate {
  const routing = legs.reduce((s, l) => s + (l.impactBps === null ? 0 : (l.usd * l.impactBps) / 10_000), 0);
  const feeBps = FEE_BPS_BY_TIER[tier] ?? FEE_BPS_BY_TIER[0];
  const fee = (amount * feeBps) / 10_000;
  const basis = (amount * BASIS_BPS_PLACEHOLDER) / 10_000;
  const total = routing + fee + basis;
  return { amount, routing, fee, feeBps, basis, total, bps: amount > 0 ? Math.round((total / amount) * 10_000) : 0, legs };
}

/** Realized cost of a fill versus the quoted mid: bps of USDC spent. */
export function realizedBps(usdcSpent: bigint, tokensReceived: bigint, midPriceUsdcPerToken: number, decimals: number): number {
  if (usdcSpent === 0n) return 0;
  const fair = (Number(tokensReceived) / 10 ** decimals) * midPriceUsdcPerToken * 1e6;
  return Math.round(((Number(usdcSpent) - fair) / Number(usdcSpent)) * 10_000);
}
