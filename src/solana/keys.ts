import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { env } from "../config.js";

const decode = (s: string) => Keypair.fromSecretKey(bs58.decode(s));
export const crankKeypair = () => decode(env.CRANK_SECRET);
export const sponsorKeypair = () => decode(env.SPONSOR_SECRET);
