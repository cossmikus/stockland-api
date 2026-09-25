import { PublicKey } from "@solana/web3.js";
import type { Profile } from "./domain/allocation.js";
import { isMainnet } from "./config.js";

// Hardcoded tunables. Change here, commit, deploy. Never read these from .env.
// Mainnet USDC, or the Circle devnet USDC you get from faucet.circle.com
export const USDC_MINT = new PublicKey(isMainnet ? "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" : "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU");
export const JUPITER_V6_PROGRAM = new PublicKey("JUP6LkbZbjS1jKKwapdHNy74zcZ3tLUZoi5QNyVTaV4");
export const ASSOCIATED_TOKEN_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
export const JUP_API = "https://lite-api.jup.ag/swap/v1";
export const JUP_TOKENS = "https://lite-api.jup.ag/tokens/v1/tagged/verified";
export const SLIPPAGE_BPS = 50;
export const MAX_IMPACT_BPS = 75;            // spec 6.6: reduce/defer above this
export const MAX_ROUND_TRIP_BPS = 75;        // spec 7: depth test cut-off at $1k
export const DEPTH_SIZES_USD = [100, 1_000, 10_000];
export const EXECUTION_WINDOW_UTC = { open: 14 * 60 + 30, close: 21 * 60 }; // spec 5.2
export const EPOCH_MINUTES = 15;
export const FEE_BPS_BY_TIER = [15, 12, 8, 5];  // Squire, Knight, Thane, Laird
export const BASIS_BPS_PLACEHOLDER = 2;      // until Pyth mid is wired (Sprint 3)
export const DEPOSIT_CAP_USDC = 500;         // spec 11: cap during beta
export const MAX_SPONSOR_FEE_LAMPORTS = 50_000;
export const RPC_COMMITMENT = "confirmed" as const;
export const TX_CONFIRM_TIMEOUT_MS = 60_000;
export const PROFILE_ID: Record<Profile, number> = { Steady: 0, Balanced: 1, Opportunistic: 2 };
export const CANDIDATES = ["SPYx", "QQQx", "NVDAx", "TSLAx", "AAPLx", "MSFTx", "METAx", "AMZNx", "MSTRx", "SPCX"] as const;
export type Ticker = (typeof CANDIDATES)[number];
