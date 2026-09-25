import { PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync } from "@solana/spl-token";
import { fetchPosition, fetchProfile, programWith, accounts } from "../solana/program.js";
import { pda } from "../solana/pdas.js";
import { connection } from "../solana/rpc.js";
import { mintFacts } from "../solana/token2022.js";
import { tokensForShares } from "../domain/epoch.js";
import { tickerOf } from "./universe.js";
import { repo } from "../db/repo.js";

/** Decoded on-chain position: shares → tokens per asset, sleeve, tier, plus receipts from the DB. */
export async function positionOf(owner: PublicKey) {
  const pos = await fetchPosition(owner); if (!pos) return null;
  const profile = await fetchProfile(pos.profileId); const p = programWith();
  const holdings = [];
  for (let k = 0; k < profile.count; k++) {
    const shares = BigInt(pos.shares[k].toString()); if (shares === 0n) continue;
    const mint = new PublicKey(profile.mints[k]); const f = await mintFacts(mint);
    const av = await accounts(p).assetVault.fetch(pda.asset(mint));
    const bal = BigInt((await connection.getTokenAccountBalance(getAssociatedTokenAddressSync(mint, pda.vaultAuth(), true, f.tokenProgram))).value.amount);
    const tokens = tokensForShares(shares, bal, BigInt(av.totalShares.toString()));
    holdings.push({ index: k, ticker: tickerOf(mint), mint: f.mint, token2022: f.is2022, shares: shares.toString(), tokens: tokens.toString(), decimals: f.decimals, weightBps: profile.weightsBps[k] });
  }
  const receipts = await repo.submissionsFor(owner.toBase58());
  return { owner: owner.toBase58(), profileId: pos.profileId, tier: pos.tier, tenureStart: Number(pos.tenureStart.toString()), sleeveUsdc: pos.sleeveUsdc.toString(), holdings, receipts };
}
