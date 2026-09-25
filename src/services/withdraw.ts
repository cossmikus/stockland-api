import { PublicKey, Transaction } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { createAssociatedTokenAccountIdempotentInstruction, getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { USDC_MINT } from "../constants.js";
import { programWith, fetchConfig, fetchPosition, fetchProfile, accounts } from "../solana/program.js";
import { pda, usdcVault, userUsdc } from "../solana/pdas.js";
import { connection } from "../solana/rpc.js";
import { sponsorKeypair } from "../solana/keys.js";
import { mintFacts } from "../solana/token2022.js";
import { tokensForShares } from "../domain/epoch.js";

/** A4: one transfer per held asset plus the sleeve, in one transaction. Hooks are resolved on-chain by the program. */
export async function buildWithdrawInKindTx(owner: PublicKey) {
  const pos = await fetchPosition(owner); if (!pos) throw new Error("no position");
  const profile = await fetchProfile(pos.profileId);
  const p = programWith(); const sponsor = sponsorKeypair().publicKey; const tx = new Transaction(); const legs: { ticker: string; mint: string; tokens: string }[] = [];
  for (let k = 0; k < profile.count; k++) {
    const shares = BigInt(pos.shares[k].toString()); if (shares === 0n) continue;
    const mint = new PublicKey(profile.mints[k]); const f = await mintFacts(mint);
    const av = await accounts(p).assetVault.fetch(pda.asset(mint));
    const vaultToken = getAssociatedTokenAddressSync(mint, pda.vaultAuth(), true, f.tokenProgram);
    const bal = BigInt((await connection.getTokenAccountBalance(vaultToken)).value.amount);
    const userToken = getAssociatedTokenAddressSync(mint, owner, false, f.tokenProgram);
    tx.add(createAssociatedTokenAccountIdempotentInstruction(sponsor, userToken, owner, mint, f.tokenProgram));
    tx.add(await p.methods.withdrawInKind(k).accounts({ config: pda.config(), profile: pda.profile(pos.profileId), position: pda.position(owner), vaultAuth: pda.vaultAuth(), assetVault: pda.asset(mint), mint, vaultToken, userToken, owner, tokenProgram: f.tokenProgram }).instruction());
    legs.push({ ticker: f.mint.slice(0, 6), mint: f.mint, tokens: tokensForShares(shares, bal, BigInt(av.totalShares.toString())).toString() });
  }
  const sleeve = BigInt(pos.sleeveUsdc.toString());
  if (sleeve > 0n) {
    tx.add(createAssociatedTokenAccountIdempotentInstruction(sponsor, userUsdc(owner), owner, USDC_MINT, TOKEN_PROGRAM_ID));
    tx.add(await p.methods.withdrawSleeve(new BN(sleeve.toString())).accounts({ config: pda.config(), position: pda.position(owner), vaultAuth: pda.vaultAuth(), usdcMint: USDC_MINT, usdcVault: usdcVault(), userUsdc: userUsdc(owner), owner, tokenProgram: TOKEN_PROGRAM_ID }).instruction());
  }
  if (tx.instructions.length === 0) throw new Error("nothing to withdraw");
  tx.feePayer = sponsor; tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  return { tx: tx.serialize({ requireAllSignatures: false }).toString("base64"), legs, sleeveUsdc: sleeve.toString(), sponsor: sponsor.toBase58() };
}

/** Sell to USDC: queue shares of one asset into the open epoch. Paid out by the crank after execution. */
export async function buildRequestSellTx(owner: PublicKey, assetIndex: number, shares: bigint) {
  const pos = await fetchPosition(owner); if (!pos) throw new Error("no position");
  const profile = await fetchProfile(pos.profileId); const cfg = await fetchConfig(); const epoch = BigInt(cfg.currentEpoch.toString());
  const mint = new PublicKey(profile.mints[assetIndex]); const f = await mintFacts(mint);
  const p = programWith(); const sponsor = sponsorKeypair().publicKey;
  const tx = new Transaction().add(await p.methods.requestSell(assetIndex, new BN(shares.toString())).accounts({
    config: pda.config(), profile: pda.profile(pos.profileId), position: pda.position(owner), epoch: pda.epoch(epoch), assetVault: pda.asset(mint),
    vaultToken: getAssociatedTokenAddressSync(mint, pda.vaultAuth(), true, f.tokenProgram), pendingSell: pda.pendingSell(owner, mint, epoch), owner, systemProgram: new PublicKey("11111111111111111111111111111111"),
  }).instruction());
  tx.feePayer = sponsor; tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  return { tx: tx.serialize({ requireAllSignatures: false }).toString("base64"), epoch: epoch.toString(), sponsor: sponsor.toBase58() };
}
