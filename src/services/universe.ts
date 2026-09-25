import { readFileSync } from "node:fs";
import { PublicKey } from "@solana/web3.js";

export type UniverseEntry = { mint: PublicKey; decimals: number };
let cache: Record<string, UniverseEntry> | null = null;

/** Locked asset list from the depth test (depth/universe.json). Empty until `npm run check:depth` has run. */
export function universe(): Record<string, UniverseEntry> {
  if (cache) return cache;
  try {
    const j = JSON.parse(readFileSync(new URL("../../depth/universe.json", import.meta.url), "utf8")) as { mints: Record<string, { mint: string; decimals: number }> };
    cache = Object.fromEntries(Object.entries(j.mints).map(([t, m]) => [t, { mint: new PublicKey(m.mint), decimals: m.decimals }]));
  } catch { cache = {}; }
  return cache;
}
export const tickerOf = (mint: PublicKey) => Object.entries(universe()).find(([, v]) => v.mint.equals(mint))?.[0] ?? mint.toBase58().slice(0, 6);
