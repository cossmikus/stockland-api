import { EXECUTION_WINDOW_UTC, MAX_IMPACT_BPS, DEPOSIT_CAP_USDC } from "../constants.js";

/** Spec 6.6: execution only inside 14:30–21:00 UTC on weekdays. */
export function marketState(now = new Date()) {
  const m = now.getUTCHours() * 60 + now.getUTCMinutes();
  const weekday = now.getUTCDay() >= 1 && now.getUTCDay() <= 5;
  const open = weekday && m >= EXECUTION_WINDOW_UTC.open && m <= EXECUTION_WINDOW_UTC.close;
  let minutesToOpen = 0;
  if (!open) {
    minutesToOpen = (EXECUTION_WINDOW_UTC.open - m + 24 * 60) % (24 * 60);
    const day = now.getUTCDay();
    if (day === 6) minutesToOpen += 24 * 60; if (day === 0) minutesToOpen += 0; if (day === 5 && m > EXECUTION_WINDOW_UTC.close) minutesToOpen += 2 * 24 * 60;
  }
  return { open, minutesToOpen };
}
export const impactOk = (impactBps: number) => impactBps <= MAX_IMPACT_BPS;
export const depositOk = (usd: number) => usd > 0 && usd <= DEPOSIT_CAP_USDC;
