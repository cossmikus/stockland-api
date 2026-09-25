import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import pino from "pino";
import { JUPITER_V6_PROGRAM, USDC_MINT } from "../constants.js";
import { marketState, impactOk } from "../domain/guards.js";
import { programWith, fetchConfig, fetchEpoch, fetchProfile, accounts, epochMemcmp } from "../solana/program.js";
import { pda, usdcVault, userUsdc } from "../solana/pdas.js";
import { crankKeypair } from "../solana/keys.js";
import { quote, impactBps, swapInstructions } from "../solana/jupiter.js";
import { loadLuts, sendV0 } from "../solana/rpc.js";
import { mintFacts } from "../solana/token2022.js";
import { repo } from "../db/repo.js";
import { tickerOf } from "./universe.js";

const log = pino({ name: "crank" });
const bi = (x: BN) => BigInt(x.toString());

/**
 * One idempotent epoch turn (spec 6.4): close → one netted swap per asset (buys then sells) → mark executed →
 * settle every pending deposit and sell → open the next epoch. Guards: execution window, price impact.
 * Safe to re-run at any point; each step checks on-chain state first.
 */
export async function runEpochTurn() {
  const ms = marketState();
  if (!ms.open) { log.info({ minutesToOpen: ms.minutesToOpen }, "outside execution window; deposits keep earning in the sleeve"); return { skipped: "window" }; }
  const crank = crankKeypair(); const p = programWith(crank);
  const cfg = await fetchConfig();
  const epochId = bi(cfg.currentEpoch); const epochPk = pda.epoch(epochId);
  let e = await fetchEpoch(epochId);
  log.info({ epochId: epochId.toString(), status: e.status, assets: e.count, deposits: e.totalDeposits.toString() }, "epoch");

  if (e.status === 0) { await p.methods.closeEpoch().accounts({ config: pda.config(), epoch: epochPk, crank: crank.publicKey }).rpc(); await repo.upsertEpoch(epochId, 1); e = await fetchEpoch(epochId); }

  if (e.status === 1) {
    for (let i = 0; i < e.count; i++) {
      const mint = new PublicKey(e.mints[i]); const f = await mintFacts(mint);
      const vaultToken = getAssociatedTokenAddressSync(mint, pda.vaultAuth(), true, f.tokenProgram);
      const owe = bi(e.buyUsdc[i]) - bi(e.spentUsdc[i]); const toSell = bi(e.sellTokens[i]) - bi(e.soldTokens[i]);
      for (const [side, amount, inMint, outMint] of [[0, owe, USDC_MINT, mint], [1, toSell, mint, USDC_MINT]] as const) {
        if (amount <= 0n) continue;
        const q = await quote(inMint, outMint, amount); const imp = impactBps(q);
        if (!impactOk(imp)) { log.warn({ mint: f.mint, side, imp }, "impact above cap, deferred to next epoch"); continue; }
        const { swap, setup, luts } = await swapInstructions(q, pda.vaultAuth());
        const remaining = swap.keys.map((k) => ({ ...k, isSigner: k.pubkey.equals(pda.vaultAuth()) ? false : k.isSigner }));
        const ix = await p.methods.executeSwap(i, side, swap.data).accounts({ config: pda.config(), epoch: epochPk, vaultAuth: pda.vaultAuth(), usdcVault: usdcVault(), assetVault: pda.asset(mint), vaultToken, jupiterProgram: JUPITER_V6_PROGRAM, crank: crank.publicKey }).remainingAccounts(remaining).instruction();
        const signature = await sendV0([...setup, ix], crank, await loadLuts(luts));
        const after = await fetchEpoch(epochId);
        const usdc = side === 0 ? bi(after.spentUsdc[i]) - bi(e.spentUsdc[i]) : bi(after.sellReceivedUsdc[i]) - bi(e.sellReceivedUsdc[i]);
        const tokens = side === 0 ? bi(after.filledTokens[i]) - bi(e.filledTokens[i]) : bi(after.soldTokens[i]) - bi(e.soldTokens[i]);
        await repo.addFill({ epochId, mint: f.mint, ticker: tickerOf(mint), side, usdc, tokens, quotedImpactBps: String(imp), route: q.routePlan.map((r) => r.swapInfo.label).join(">"), signature });
        log.info({ mint: f.mint, side, amount: amount.toString(), imp, signature }, "filled"); e = after;
      }
    }
    await p.methods.markExecuted().accounts({ config: pda.config(), epoch: epochPk, crank: crank.publicKey }).rpc();
    await repo.upsertEpoch(epochId, 2, { executedAt: new Date() }); e = await fetchEpoch(epochId);
  }

  if (e.status === 2) {
    for (const d of await accounts(p).pendingDeposit.all(epochMemcmp(epochId))) {
      if (d.account.settled) continue;
      const profile = await fetchProfile(d.account.profileId);
      const remaining = d.account.mode === 0 ? Array.from({ length: profile.count }, (_, k) => ({ pubkey: pda.asset(new PublicKey(profile.mints[k])), isSigner: false, isWritable: true })) : [];
      const sig = await p.methods.settleDeposit().accounts({ config: pda.config(), epoch: epochPk, pending: d.publicKey, profile: pda.profile(d.account.profileId), position: pda.position(d.account.owner), owner: d.account.owner, crank: crank.publicKey }).remainingAccounts(remaining).rpc();
      log.info({ owner: d.account.owner.toBase58(), amount: d.account.amount.toString(), sig }, "settled deposit");
    }
    for (const s of await accounts(p).pendingSell.all(epochMemcmp(epochId))) {
      if (s.account.settled) continue;
      const sig = await p.methods.settleSell().accounts({ config: pda.config(), epoch: epochPk, pendingSell: s.publicKey, vaultAuth: pda.vaultAuth(), usdcMint: USDC_MINT, usdcVault: usdcVault(), userUsdc: userUsdc(s.account.owner), owner: s.account.owner, crank: crank.publicKey, tokenProgram: TOKEN_PROGRAM_ID }).rpc();
      log.info({ owner: s.account.owner.toBase58(), sig }, "settled sell");
    }
    const next = epochId + 1n;
    await p.methods.openEpoch(new BN(next.toString())).accounts({ config: pda.config(), epoch: pda.epoch(next), crank: crank.publicKey }).rpc();
    await repo.upsertEpoch(epochId, 2, { settledAt: new Date(), totalDepositsUsdc: bi(e.totalDeposits) }); await repo.upsertEpoch(next, 0, { openedAt: new Date() });
    log.info({ next: next.toString() }, "opened next epoch");
  }
  return { epoch: epochId.toString() };
}
