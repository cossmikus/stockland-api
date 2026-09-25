import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { JUP_API, JUPITER_V6_PROGRAM, SLIPPAGE_BPS } from "../constants.js";

export type JupQuote = { inAmount: string; outAmount: string; priceImpactPct: string; routePlan: { swapInfo: { label: string } }[] };
type IxJson = { programId: string; accounts: { pubkey: string; isSigner: boolean; isWritable: boolean }[]; data: string };

export async function quote(inputMint: PublicKey, outputMint: PublicKey, amount: bigint): Promise<JupQuote> {
  const u = new URL(`${JUP_API}/quote`);
  u.searchParams.set("inputMint", inputMint.toBase58()); u.searchParams.set("outputMint", outputMint.toBase58());
  u.searchParams.set("amount", amount.toString()); u.searchParams.set("slippageBps", String(SLIPPAGE_BPS)); u.searchParams.set("restrictIntermediateTokens", "true");
  const r = await fetch(u); if (!r.ok) throw new Error(`jupiter quote ${r.status}: ${await r.text()}`);
  return (await r.json()) as JupQuote;
}
export const impactBps = (q: JupQuote) => Math.round(Number(q.priceImpactPct) * 10_000 * 10) / 10;

/** Swap instructions for a PDA user; the program signs the CPI. Returns setup ixs, the swap ix and LUT addresses. */
export async function swapInstructions(quoteResponse: JupQuote, user: PublicKey) {
  const r = await fetch(`${JUP_API}/swap-instructions`, { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ quoteResponse, userPublicKey: user.toBase58(), wrapAndUnwrapSol: false, useSharedAccounts: true, skipUserAccountsRpcCalls: true, dynamicComputeUnitLimit: true }) });
  if (!r.ok) throw new Error(`jupiter swap-instructions ${r.status}: ${await r.text()}`);
  const j = (await r.json()) as { swapInstruction: IxJson; setupInstructions: IxJson[]; addressLookupTableAddresses: string[] };
  const toIx = (x: IxJson) => new TransactionInstruction({ programId: new PublicKey(x.programId), keys: x.accounts.map((a) => ({ pubkey: new PublicKey(a.pubkey), isSigner: a.isSigner, isWritable: a.isWritable })), data: Buffer.from(x.data, "base64") });
  if (!new PublicKey(j.swapInstruction.programId).equals(JUPITER_V6_PROGRAM)) throw new Error("swap instruction is not Jupiter v6");
  return { swap: toIx(j.swapInstruction), setup: j.setupInstructions.map(toIx), luts: j.addressLookupTableAddresses.map((a) => new PublicKey(a)) };
}
