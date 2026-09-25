import { PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { PROFILE_ID, USDC_MINT } from "../constants.js";
import { depositOk } from "../domain/guards.js";
import type { Profile } from "../domain/allocation.js";
import { programWith, fetchConfig, fetchPosition } from "../solana/program.js";
import { pda, usdcVault, userUsdc } from "../solana/pdas.js";
import { connection } from "../solana/rpc.js";
import { sponsorKeypair } from "../solana/keys.js";

/** Build an unsigned deposit transaction with the sponsor as fee payer. The user signs only as owner. */
export async function buildDepositTx(owner: PublicKey, profile: Profile, amountUsdc: number, mode: 0 | 1, quizHash: number[]) {
  if (!depositOk(amountUsdc)) throw new Error("amount outside beta cap");
  const p = programWith();
  const cfg = await fetchConfig();
  if (cfg.paused) throw new Error("deposits are paused");
  const epoch = BigInt(cfg.currentEpoch.toString());
  const sponsor = sponsorKeypair().publicKey;
  const tx = new Transaction();
  if (!(await fetchPosition(owner))) {
    tx.add(await p.methods.createPosition(PROFILE_ID[profile], quizHash).accounts({ config: pda.config(), profile: pda.profile(PROFILE_ID[profile]), position: pda.position(owner), owner, systemProgram: SystemProgram.programId }).instruction());
  }
  tx.add(await p.methods.deposit(new BN(Math.round(amountUsdc * 1e6)), mode).accounts({
    config: pda.config(), profile: pda.profile(PROFILE_ID[profile]), position: pda.position(owner), epoch: pda.epoch(epoch), pending: pda.pending(owner, epoch),
    vaultAuth: pda.vaultAuth(), usdcMint: USDC_MINT, userUsdc: userUsdc(owner), usdcVault: usdcVault(), owner, payer: sponsor, tokenProgram: TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId,
  }).instruction());
  tx.feePayer = sponsor;
  tx.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
  return { tx: tx.serialize({ requireAllSignatures: false }).toString("base64"), epoch: epoch.toString(), sponsor: sponsor.toBase58() };
}
