/** Share math mirrored from programs/stockland/src/lib.rs. Pure, so it can be unit-tested against the program. */
export function sharesForDeposit(userUsdc: bigint, epochBuyUsdc: bigint, epochFilledTokens: bigint, sharesSnapshot: bigint, balanceBefore: bigint): bigint {
  if (epochBuyUsdc === 0n) return 0n;
  const tokens = (userUsdc * epochFilledTokens) / epochBuyUsdc;
  if (sharesSnapshot === 0n || balanceBefore === 0n) return tokens;
  return (tokens * sharesSnapshot) / balanceBefore;
}
export function tokensForShares(shares: bigint, vaultBalance: bigint, totalShares: bigint): bigint {
  return totalShares === 0n ? 0n : (shares * vaultBalance) / totalShares;
}
export function usdcForSell(tokens: bigint, epochSellTokens: bigint, epochReceivedUsdc: bigint): bigint {
  return epochSellTokens === 0n ? 0n : (tokens * epochReceivedUsdc) / epochSellTokens;
}
/** Weight in bps of a deposit that goes to one asset (matches the on-chain integer division). */
export function legUsdc(amount: bigint, weightBps: number): bigint { return (amount * BigInt(weightBps)) / 10_000n; }
