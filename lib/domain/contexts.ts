export const FLORIDA_CONTEXT_START = "2026-07-01";

export function contextForPeriod(period: string): "georgia-home" | "florida-home" {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(period)) throw new Error(`Expected ISO date: ${period}`);
  return period >= FLORIDA_CONTEXT_START ? "florida-home" : "georgia-home";
}
