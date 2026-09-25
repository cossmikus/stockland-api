import { Transaction } from "@solana/web3.js";
import { sponsorKeypair } from "../solana/keys.js";
import { validateForSponsor } from "../solana/tx.js";
import { sendLegacy } from "../solana/rpc.js";
import { repo } from "../db/repo.js";

/** Co-sign a user-signed transaction as fee payer and send it. */
export async function sponsorAndSend(txB64: string, meta: { owner: string; kind: string; amountUsdc?: bigint; estimatedBps?: number; epochId?: bigint }) {
  const sponsor = sponsorKeypair();
  const tx = Transaction.from(Buffer.from(txB64, "base64"));
  await validateForSponsor(tx, sponsor);
  tx.partialSign(sponsor);
  const signature = await sendLegacy(tx);
  await repo.addSubmission({ owner: meta.owner, kind: meta.kind, signature, amountUsdc: meta.amountUsdc, estimatedBps: meta.estimatedBps, epochId: meta.epochId });
  return signature;
}
export const sponsorPubkey = () => sponsorKeypair().publicKey.toBase58();
