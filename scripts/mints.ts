import { PublicKey } from "@solana/web3.js";
import { CANDIDATES, JUP_TOKENS, type Ticker } from "../src/constants.js";

export type MintInfo = { symbol: Ticker; mint: PublicKey; decimals: number; name: string };

/** Resolve the xStocks candidate mints from Jupiter's verified token list, by symbol. */
export async function resolveMints(): Promise<MintInfo[]> {
  const res = await fetch(JUP_TOKENS);
  if (!res.ok) throw new Error(`token list ${res.status}`);
  const list = (await res.json()) as { symbol: string; address: string; decimals: number; name: string; tags?: string[] }[];
  const out: MintInfo[] = [];
  for (const symbol of CANDIDATES) {
    const hits = list.filter((t) => t.symbol.toLowerCase() === symbol.toLowerCase());
    if (hits.length === 0) { console.warn(`! ${symbol}: not in verified list, skipped (add manually if you trust the mint)`); continue; }
    if (hits.length > 1) console.warn(`! ${symbol}: ${hits.length} verified entries, taking the first: ${hits.map((h) => h.address).join(", ")}`);
    const t = hits[0];
    out.push({ symbol, mint: new PublicKey(t.address), decimals: t.decimals, name: t.name });
  }
  return out;
}
