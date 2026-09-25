import { Transaction, Keypair } from "@solana/web3.js";
import { connection } from "./rpc.js";
import { PROGRAM_ID } from "./pdas.js";
import { ASSOCIATED_TOKEN_PROGRAM, MAX_SPONSOR_FEE_LAMPORTS } from "../constants.js";

const ALLOWED = () => new Set([PROGRAM_ID.toBase58(), ASSOCIATED_TOKEN_PROGRAM.toBase58()]);

/** Sponsored fee payer (spec 3.2). Refuses anything that is not our program or ATA creation, or where the sponsor is an authority. */
export async function validateForSponsor(tx: Transaction, sponsor: Keypair) {
  if (!tx.feePayer?.equals(sponsor.publicKey)) throw new Error("fee payer must be the sponsor");
  for (const ix of tx.instructions) {
    if (!ALLOWED().has(ix.programId.toBase58())) throw new Error(`program not allowed: ${ix.programId.toBase58()}`);
    if (ix.keys.some((k) => k.pubkey.equals(sponsor.publicKey) && k.isSigner && !k.isWritable)) throw new Error("sponsor may not be an authority");
  }
  const fee = await connection.getFeeForMessage(tx.compileMessage());
  if ((fee.value ?? 0) > MAX_SPONSOR_FEE_LAMPORTS) throw new Error("fee above sponsor cap");
}
