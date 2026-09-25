import { Connection, Keypair, TransactionInstruction, TransactionMessage, VersionedTransaction, AddressLookupTableAccount, Transaction } from "@solana/web3.js";
import { rpcUrl } from "../config.js";
import { RPC_COMMITMENT, TX_CONFIRM_TIMEOUT_MS } from "../constants.js";

export const connection = new Connection(rpcUrl, { commitment: RPC_COMMITMENT, confirmTransactionInitialTimeout: TX_CONFIRM_TIMEOUT_MS });

export async function loadLuts(addresses: import("@solana/web3.js").PublicKey[]) {
  const out: AddressLookupTableAccount[] = [];
  for (const a of addresses) { const r = await connection.getAddressLookupTable(a); if (r.value) out.push(r.value); }
  return out;
}

/** Simulate, then send a v0 transaction signed by `signers`, and confirm. Throws with logs on failure. */
export async function sendV0(ixs: TransactionInstruction[], payer: Keypair, luts: AddressLookupTableAccount[] = [], extraSigners: Keypair[] = []) {
  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
  const msg = new TransactionMessage({ payerKey: payer.publicKey, recentBlockhash: blockhash, instructions: ixs }).compileToV0Message(luts);
  const tx = new VersionedTransaction(msg);
  tx.sign([payer, ...extraSigners]);
  const sim = await connection.simulateTransaction(tx, { sigVerify: true });
  if (sim.value.err) throw new Error(`simulation failed: ${JSON.stringify(sim.value.err)} :: ${(sim.value.logs ?? []).slice(-6).join(" | ")}`);
  const signature = await connection.sendTransaction(tx, { maxRetries: 3 });
  await connection.confirmTransaction({ signature, blockhash, lastValidBlockHeight }, RPC_COMMITMENT);
  return signature;
}

export async function sendLegacy(tx: Transaction) {
  const signature = await connection.sendRawTransaction(tx.serialize(), { maxRetries: 3 });
  const bh = await connection.getLatestBlockhash();
  await connection.confirmTransaction({ signature, ...bh }, RPC_COMMITMENT);
  return signature;
}
