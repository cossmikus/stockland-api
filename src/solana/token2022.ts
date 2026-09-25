import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, getMint, getExtensionTypes, ExtensionType, getTransferHook, getPermanentDelegate, getTransferFeeConfig } from "@solana/spl-token";
import { connection } from "./rpc.js";

export type MintFacts = { mint: string; tokenProgram: PublicKey; is2022: boolean; decimals: number; extensions: string[]; transferHook: string | null; permanentDelegate: string | null; transferFeeBps: number | null };

/** Read a mint's owner program and Token-2022 extensions. Read-only. */
export async function mintFacts(mint: PublicKey): Promise<MintFacts> {
  const info = await connection.getAccountInfo(mint);
  if (!info) throw new Error(`mint not found: ${mint.toBase58()}`);
  const tokenProgram = info.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
  const m = await getMint(connection, mint, "confirmed", tokenProgram);
  const is2022 = tokenProgram.equals(TOKEN_2022_PROGRAM_ID);
  const hook = is2022 ? getTransferHook(m) : null, pd = is2022 ? getPermanentDelegate(m) : null, fee = is2022 ? getTransferFeeConfig(m) : null;
  return { mint: mint.toBase58(), tokenProgram, is2022, decimals: m.decimals, extensions: is2022 ? getExtensionTypes(m.tlvData).map((e) => ExtensionType[e]) : [],
    transferHook: hook?.programId?.toBase58() ?? null, permanentDelegate: pd?.delegate?.toBase58() ?? null, transferFeeBps: fee ? fee.newerTransferFee.transferFeeBasisPoints : null };
}
