import { describe, it, expect } from "vitest";
import { sharesForDeposit, tokensForShares, usdcForSell, legUsdc } from "./epoch.js";
import { restrictTo, target } from "./allocation.js";

describe("share math", () => {
  it("first depositor gets shares 1:1 with tokens", () => { expect(sharesForDeposit(25_000_000n, 25_000_000n, 3_812n, 0n, 0n)).toBe(3_812n); });
  it("later depositors get pro-rata shares", () => { expect(sharesForDeposit(50_000_000n, 100_000_000n, 10_000n, 1_000n, 10_000n)).toBe(500n); });
  it("round trips tokens", () => { expect(tokensForShares(500n, 15_000n, 1_500n)).toBe(5_000n); });
  it("splits sell proceeds", () => { expect(usdcForSell(10n, 40n, 4_000_000n)).toBe(1_000_000n); });
  it("leg math matches integer division", () => { expect(legUsdc(100_000_000n, 2_500)).toBe(25_000_000n); });
});
describe("allocation", () => {
  it("sums to 100", () => { for (const p of ["Steady", "Balanced", "Opportunistic"] as const) expect(target(p, 100).reduce((s, w) => s + w.usd, 0)).toBeCloseTo(100, 6); });
  it("renormalises when a mint is dropped", () => { const w = restrictTo("Opportunistic", new Set(["NVDAx", "QQQx", "TSLAx", "SPYx", "METAx", "AMZNx"])); expect(w.reduce((s, x) => s + x.pct, 0)).toBeCloseTo(100, 1); expect(w.find((x) => x.ticker === "MSTRx")).toBeUndefined(); });
});
