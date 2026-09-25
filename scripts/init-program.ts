/**
 * One-time on-chain setup after `anchor deploy`: config, three profiles, one vault per locked mint, epoch 1.
 *   npm run init:program        (uses keys/deploy.json as admin, CRANK_SECRET as crank)
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { programWith } from "../src/solana/program.js";
import { pda, usdcVault } from "../src/solana/pdas.js";
import { crankKeypair } from "../src/solana/keys.js";
import { mintFacts } from "../src/solana/token2022.js";
import { universe } from "../src/services/universe.js";
import { WEIGHTS, restrictTo, type Profile } from "../src/domain/allocation.js";
import { USDC_MINT, JUPITER_V6_PROGRAM, FEE_BPS_BY_TIER, EPOCH_MINUTES, MAX_IMPACT_BPS, PROFILE_ID } from "../src/constants.js";

const admin = Keypair.fromSecretKey(Uint8Array.from(JSON.parse(readFileSync("keys/deploy.json", "utf8"))));
const p = programWith(admin); const crank = crankKeypair();
const uni = universe(); const allowed = new Set(Object.keys(uni));

async function main() {
  if (allowed.size === 0) throw new Error("depth/universe.json is empty: run npm run check:depth first");
  console.log("init_config"); await p.methods.initConfig(crank.publicKey, JUPITER_V6_PROGRAM, FEE_BPS_BY_TIER, EPOCH_MINUTES * 60, MAX_IMPACT_BPS)
    .accounts({ config: pda.config(), vaultAuth: pda.vaultAuth(), usdcMint: USDC_MINT, usdcVault: usdcVault(), admin: admin.publicKey, tokenProgram: TOKEN_PROGRAM_ID, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).rpc();
  for (const profile of Object.keys(WEIGHTS) as Profile[]) {
    const w = restrictTo(profile, allowed); const eq = w.filter((x) => !x.sleeve); const sleeve = w.find((x) => x.sleeve)!.pct;
    const mints = eq.map((x) => uni[x.ticker].mint); const bps = eq.map((x) => Math.round(x.pct * 100));
    const drift = 10_000 - bps.reduce((s, b) => s + b, 0) - Math.round(sleeve * 100); bps[0] += drift; // rounding lands on the first leg
    console.log(`init_profile ${profile}`, eq.map((x, i) => `${x.ticker}:${bps[i]}`).join(" "), `sleeve:${Math.round(sleeve * 100)}`);
    await p.methods.initProfile(PROFILE_ID[profile], mints, bps, Math.round(sleeve * 100)).accounts({ config: pda.config(), profile: pda.profile(PROFILE_ID[profile]), admin: admin.publicKey, systemProgram: SystemProgram.programId }).rpc();
  }
  for (const [ticker, m] of Object.entries(uni)) {
    const f = await mintFacts(m.mint);
    console.log(`init_asset_vault ${ticker} (${f.is2022 ? "Token-2022" : "SPL"})`);
    await p.methods.initAssetVault().accounts({ config: pda.config(), vaultAuth: pda.vaultAuth(), mint: m.mint, assetVault: pda.asset(m.mint), vaultToken: PublicKey.findProgramAddressSync([pda.vaultAuth().toBuffer(), f.tokenProgram.toBuffer(), m.mint.toBuffer()], ASSOCIATED_TOKEN_PROGRAM_ID)[0], admin: admin.publicKey, tokenProgram: f.tokenProgram, associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID, systemProgram: SystemProgram.programId }).rpc();
  }
  console.log("open_epoch 1"); await programWith(crank).methods.openEpoch(new BN(1)).accounts({ config: pda.config(), epoch: pda.epoch(1n), crank: crank.publicKey, systemProgram: SystemProgram.programId }).rpc();
  console.log("done");
}
main().catch((e) => { console.error(e); process.exit(1); });
