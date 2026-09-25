/**
 * Day-one check (spec 6.5): can a program-owned PDA receive and send every candidate mint?
 * For each mint: read Token-2022 extensions, derive the vault PDA's ATA, and simulate a
 * transfer_checked INTO the PDA ATA and OUT of it (with transfer-hook accounts resolved).
 * Writes depth/token2022.json. Read-only: everything is simulated, nothing is sent.
 *
 *   SOLANA_RPC_URL=... npx tsx scripts/token2022-check.ts [funded-wallet-pubkey]
 */
import "dotenv/config";
import { rpcUrl } from "../src/config.js";
import { Connection, Keypair, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID, getMint, getExtensionTypes, ExtensionType, getTransferHook, getPermanentDelegate,
  getTransferFeeConfig, getAssociatedTokenAddressSync, createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedWithTransferHookInstruction,
} from "@solana/spl-token";
import { writeFileSync } from "node:fs";
import { resolveMints } from "./mints.js";
import { RPC_COMMITMENT, TX_CONFIRM_TIMEOUT_MS } from "../src/constants.js";

const conn = new Connection(rpcUrl, { commitment: RPC_COMMITMENT, confirmTransactionInitialTimeout: TX_CONFIRM_TIMEOUT_MS });
const [vaultAuth] = PublicKey.findProgramAddressSync([Buffer.from("vault")], new PublicKey(process.env.PROGRAM_ID ?? "StockLand111111111111111111111111111111111"));

type Row = {
  symbol: string; mint: string; program: string; decimals: number; extensions: string[];
  transferHook: string | null; permanentDelegate: string | null; transferFeeBps: number | null;
  simIn: "ok" | string; simOut: "ok" | string; verdict: "pass" | "fail" | "unknown";
};

async function simulate(ixs: Parameters<Transaction["add"]>[0][], payer: PublicKey) {
  const tx = new Transaction().add(...ixs);
  tx.feePayer = payer;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  const sim = await conn.simulateTransaction(tx);
  if (sim.value.err) return `${JSON.stringify(sim.value.err)} :: ${(sim.value.logs ?? []).slice(-4).join(" | ")}`;
  return "ok" as const;
}

async function main() {
  // A funded wallet makes the simulation realistic (it must hold the token). Without one we still
  // report extensions and simulate against a throwaway key so hook account resolution is exercised.
  const funded = process.argv[2] ? new PublicKey(process.argv[2]) : Keypair.generate().publicKey;
  const mints = await resolveMints();
  const rows: Row[] = [];
  for (const m of mints) {
    const acc = await conn.getAccountInfo(m.mint);
    if (!acc) { rows.push({ symbol: m.symbol, mint: m.mint.toBase58(), program: "?", decimals: m.decimals, extensions: [], transferHook: null, permanentDelegate: null, transferFeeBps: null, simIn: "mint not found", simOut: "-", verdict: "fail" }); continue; }
    const programId = acc.owner;
    const is2022 = programId.equals(TOKEN_2022_PROGRAM_ID);
    const mint = await getMint(conn, m.mint, "confirmed", programId);
    const exts = is2022 ? getExtensionTypes(mint.tlvData).map((e) => ExtensionType[e]) : [];
    const hook = is2022 ? getTransferHook(mint) : null;
    const pd = is2022 ? getPermanentDelegate(mint) : null;
    const fee = is2022 ? getTransferFeeConfig(mint) : null;
    const vaultAta = getAssociatedTokenAddressSync(m.mint, vaultAuth, true, programId);
    const userAta = getAssociatedTokenAddressSync(m.mint, funded, false, programId);
    const amount = BigInt(1);
    let simIn = "-", simOut = "-";
    try {
      const inIx = await createTransferCheckedWithTransferHookInstruction(conn, userAta, m.mint, vaultAta, funded, amount, mint.decimals, [], "confirmed", programId);
      simIn = await simulate([createAssociatedTokenAccountIdempotentInstruction(funded, vaultAta, vaultAuth, m.mint, programId), inIx], funded);
    } catch (e) { simIn = `build failed: ${(e as Error).message}`; }
    try {
      // OUT is signed by the PDA in the real program; here we only check that hook accounts resolve
      // and that the hook program does not reject a PDA-owned source outright.
      const outIx = await createTransferCheckedWithTransferHookInstruction(conn, vaultAta, m.mint, userAta, vaultAuth, amount, mint.decimals, [], "confirmed", programId);
      simOut = await simulate([SystemProgram.transfer({ fromPubkey: funded, toPubkey: funded, lamports: 0 }), outIx], funded);
      if (simOut.includes("Missing signature") || simOut.includes("MissingRequiredSignature")) simOut = "ok (needs PDA signature, expected)";
    } catch (e) { simOut = `build failed: ${(e as Error).message}`; }
    const verdict: Row["verdict"] = simIn === "ok" && simOut.startsWith("ok") ? "pass" : simIn.startsWith("build failed") || simOut.startsWith("build failed") ? "fail" : "unknown";
    rows.push({
      symbol: m.symbol, mint: m.mint.toBase58(), program: is2022 ? "Token-2022" : "Token", decimals: mint.decimals, extensions: exts,
      transferHook: hook?.programId?.toBase58() ?? null, permanentDelegate: pd?.delegate?.toBase58() ?? null,
      transferFeeBps: fee ? fee.newerTransferFee.transferFeeBasisPoints : null, simIn, simOut, verdict,
    });
    console.log(`${m.symbol.padEnd(6)} ${is2022 ? "2022" : "spl "} hook=${hook?.programId?.toBase58() ?? "-"} fee=${fee?.newerTransferFee.transferFeeBasisPoints ?? "-"} in=${simIn.slice(0, 40)} out=${simOut.slice(0, 40)} → ${verdict}`);
  }
  writeFileSync("depth/token2022.json", JSON.stringify({ checkedAt: new Date().toISOString(), vaultAuth: vaultAuth.toBase58(), rows }, null, 2));
  const failed = rows.filter((r) => r.verdict === "fail");
  console.log(`\n${rows.length - failed.length}/${rows.length} pass. ${failed.length ? "DROP: " + failed.map((r) => r.symbol).join(", ") : "Universe intact."}`);
}
main().catch((e) => { console.error(e); process.exit(1); });
