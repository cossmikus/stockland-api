export type Profile = "Steady" | "Balanced" | "Opportunistic";
export type Weight = { ticker: string; pct: number; sleeve?: boolean };

// Target weights, spec 5.1. Fixed and public. Pure data: no IO in this module.
export const WEIGHTS: Record<Profile, Weight[]> = {
  Steady: [{ ticker: "SPYx", pct: 40 }, { ticker: "QQQx", pct: 20 }, { ticker: "AAPLx", pct: 8 }, { ticker: "MSFTx", pct: 7 }, { ticker: "USDC", pct: 25, sleeve: true }],
  Balanced: [{ ticker: "SPYx", pct: 25 }, { ticker: "QQQx", pct: 20 }, { ticker: "NVDAx", pct: 15 }, { ticker: "AAPLx", pct: 8 }, { ticker: "MSFTx", pct: 7 }, { ticker: "METAx", pct: 5 }, { ticker: "TSLAx", pct: 5 }, { ticker: "USDC", pct: 15, sleeve: true }],
  Opportunistic: [{ ticker: "NVDAx", pct: 25 }, { ticker: "QQQx", pct: 18 }, { ticker: "TSLAx", pct: 12 }, { ticker: "SPYx", pct: 10 }, { ticker: "MSTRx", pct: 10 }, { ticker: "METAx", pct: 8 }, { ticker: "AMZNx", pct: 7 }, { ticker: "USDC", pct: 10, sleeve: true }],
};
export const SLEEVE_APY = 0.065;

export function equityLegs(profile: Profile) { return WEIGHTS[profile].filter((w) => !w.sleeve); }
export function sleevePct(profile: Profile) { return WEIGHTS[profile].find((w) => w.sleeve)?.pct ?? 0; }

/** Pure: the basket in dollars for a profile and a deposit. Anyone can recompute this. */
export function target(profile: Profile, deposit: number) {
  return WEIGHTS[profile].map((w) => ({ ...w, usd: Math.round(deposit * w.pct) / 100 }));
}

/** Drop mints that failed depth/Token-2022 checks and renormalise the equity part (sleeve unchanged). */
export function restrictTo(profile: Profile, allowed: Set<string>): Weight[] {
  const eq = equityLegs(profile).filter((w) => allowed.has(w.ticker));
  const total = eq.reduce((s, w) => s + w.pct, 0);
  const equityShare = 100 - sleevePct(profile);
  const scaled = eq.map((w) => ({ ...w, pct: Math.round((w.pct / total) * equityShare * 100) / 100 }));
  return [...scaled, ...WEIGHTS[profile].filter((w) => w.sleeve)];
}
