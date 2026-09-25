import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { env } from "../config.js";
import { USDC_MINT } from "../constants.js";

export const PROGRAM_ID = new PublicKey(env.PROGRAM_ID);
const le8 = (n: bigint) => new BN(n.toString()).toArrayLike(Buffer, "le", 8);

export const pda = {
  config: () => PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID)[0],
  vaultAuth: () => PublicKey.findProgramAddressSync([Buffer.from("vault")], PROGRAM_ID)[0],
  profile: (id: number) => PublicKey.findProgramAddressSync([Buffer.from("profile"), Buffer.from([id])], PROGRAM_ID)[0],
  asset: (mint: PublicKey) => PublicKey.findProgramAddressSync([Buffer.from("asset"), mint.toBuffer()], PROGRAM_ID)[0],
  epoch: (id: bigint) => PublicKey.findProgramAddressSync([Buffer.from("epoch"), le8(id)], PROGRAM_ID)[0],
  position: (owner: PublicKey) => PublicKey.findProgramAddressSync([Buffer.from("position"), owner.toBuffer()], PROGRAM_ID)[0],
  pending: (owner: PublicKey, epoch: bigint) => PublicKey.findProgramAddressSync([Buffer.from("pending"), owner.toBuffer(), le8(epoch)], PROGRAM_ID)[0],
  pendingSell: (owner: PublicKey, mint: PublicKey, epoch: bigint) => PublicKey.findProgramAddressSync([Buffer.from("sell"), owner.toBuffer(), mint.toBuffer(), le8(epoch)], PROGRAM_ID)[0],
};
export const usdcVault = () => getAssociatedTokenAddressSync(USDC_MINT, pda.vaultAuth(), true, TOKEN_PROGRAM_ID);
export const userUsdc = (owner: PublicKey) => getAssociatedTokenAddressSync(USDC_MINT, owner, false, TOKEN_PROGRAM_ID);
