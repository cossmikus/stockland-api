/**
 * Depth test (spec section 7): Jupiter quotes at $100 / $1,000 / $10,000 in and out of each mint.
 * Round-trip cost in bps = 10000 × (1 − usdcBack / usdcIn). Drop the asset if $1k round trip > 75 bps.
 * Writes depth/depth.json and depth/universe.json (the locked list). Run during US market hours.
 *
 *   npx tsx scripts/depth-test.ts
 */
import "dotenv/config";
import { writeFileSync } from "node:fs";
import { resolveMints } from "./mints.js";
import { USDC_MINT, JUP_API, SLIPPAGE_BPS, DEPTH_SIZES_USD, MAX_ROUND_TRIP_BPS } from "../src/constants.js";

type Quote = { outAmount: string; priceImpactPct: string; routePlan: { swapInfo: { label: string } }[] };

async function quote(inputMint: string, outputMint: string, amount: bigint): Promise<Quote> {
  const u = new URL(`${JUP_API}/quote`);
  u.searchParams.set("inputMint", inputMint); u.searchParams.set("outputMint", outputMint);
  u.searchParams.set("amount", amount.toString()); u.searchParams.set("slippageBps", String(SLIPPAGE_BPS));
  u.searchParams.set("restrictIntermediateTokens", "true");
  const r = await fetch(u); if (!r.ok) throw new Error(`quote ${r.status}: ${await r.text()}`);
  return (await r.json()) as Quote;
}

async function main() {
  const mints = await resolveMints();
  const results: Record<string, unknown>[] = [];
  const universe: string[] = [];
  for (const m of mints) {
    const sizes: Record<string, unknown> = {};
    let lock = true;
    for (const usd of DEPTH_SIZES_USD) {
      const usdcIn = BigInt(usd) * 1_000_000n;
      try {
        const q1 = await quote(USDC_MINT.toBase58(), m.mint.toBase58(), usdcIn);
        const tokens = BigInt(q1.outAmount);
        const q2 = await quote(m.mint.toBase58(), USDC_MINT.toBase58(), tokens);
        const back = BigInt(q2.outAmount);
        const bps = Number(((usdcIn - back) * 10_000n) / usdcIn);
        sizes[usd] = { tokens: tokens.toString(), usdcBack: Number(back) / 1e6, roundTripBps: bps, impactIn: q1.priceImpactPct, impactOut: q2.priceImpactPct, route: q1.routePlan.map((r) => r.swapInfo.label).join(">") };
        if (usd === 1_000 && bps > MAX_ROUND_TRIP_BPS) lock = false;
        console.log(`${m.symbol.padEnd(6)} $${String(usd).padStart(6)}  round trip ${String(bps).padStart(4)} bps  via ${q1.routePlan.map((r) => r.swapInfo.label).join(">")}`);
      } catch (e) {
        sizes[usd] = { error: (e as Error).message }; if (usd === 1_000) lock = false;
        console.log(`${m.symbol.padEnd(6)} $${String(usd).padStart(6)}  no route: ${(e as Error).message.slice(0, 80)}`);
      }
      await new Promise((r) => setTimeout(r, 400)); // be polite to the free API
    }
    results.push({ symbol: m.symbol, mint: m.mint.toBase58(), decimals: m.decimals, sizes, lock });
    if (lock) universe.push(m.symbol);
  }
  writeFileSync("depth/depth.json", JSON.stringify({ testedAt: new Date().toISOString(), maxRoundTripBps: MAX_ROUND_TRIP_BPS, results }, null, 2));
  writeFileSync("depth/universe.json", JSON.stringify({ lockedAt: new Date().toISOString(), universe, mints: Object.fromEntries(mints.filter((m) => universe.includes(m.symbol)).map((m) => [m.symbol, { mint: m.mint.toBase58(), decimals: m.decimals }])) }, null, 2));
  console.log(`\nLocked universe (${universe.length}): ${universe.join(", ")}`);
  const dropped = mints.map((m) => m.symbol).filter((s) => !universe.includes(s));
  if (dropped.length) console.log(`Dropped: ${dropped.join(", ")}. Remove them from lib/allocation.ts and renormalise weights.`);
}
main().catch((e) => { console.error(e); process.exit(1); });
