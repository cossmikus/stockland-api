import { USDC_MINT } from "../constants.js";
import { equityLegs, type Profile } from "../domain/allocation.js";
import { estimate, type LegQuote } from "../domain/cost.js";
import { quote, impactBps } from "../solana/jupiter.js";
import { universe } from "./universe.js";

/** A3: live per-leg Jupiter quotes for a deposit, summed into dollars. */
export async function costPreview(amount: number, profile: Profile, tier = 0) {
  const uni = universe();
  const legs: LegQuote[] = [];
  for (const w of equityLegs(profile)) {
    const usd = (amount * w.pct) / 100;
    const m = uni[w.ticker];
    if (!m) { legs.push({ ticker: w.ticker, usd, impactBps: null, note: "not in locked universe" }); continue; }
    try { const q = await quote(USDC_MINT, m.mint, BigInt(Math.round(usd * 1e6))); legs.push({ ticker: w.ticker, usd, impactBps: impactBps(q) }); }
    catch (e) { legs.push({ ticker: w.ticker, usd, impactBps: null, note: (e as Error).message.slice(0, 80) }); }
  }
  return { ...estimate(amount, legs, tier), profile, quotedAt: new Date().toISOString() };
}
