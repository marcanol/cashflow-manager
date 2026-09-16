import { describe, expect, it } from "vitest";
import { calculateSafeToSpend, projectDailyBalances } from "../lib/domain/cashflow";
import { contextForPeriod } from "../lib/domain/contexts";
import { formatMoney } from "../lib/domain/money";

describe("golden financial fixtures", () => {
  it("calculates safe-to-spend with each protected amount deducted exactly once", () => {
    expect(calculateSafeToSpend({ availableCashCents: 500_000, pendingTransactionCents: 12_500, reservedObligationCents: 150_000, protectedAllocationCents: 25_000, requiredBillsBeforeIncomeCents: 80_000, safetyBufferCents: 50_000 })).toBe(182_500);
  });
  it("projects a deterministic, date-sorted balance sequence", () => {
    expect(projectDailyBalances(100_000, [{ id: "bill", date: "2026-09-15", amountCents: -45_000 }, { id: "income", date: "2026-09-15", amountCents: 200_000 }, { id: "rent", date: "2026-09-01", amountCents: -90_000 }])).toEqual([
      { id: "rent", date: "2026-09-01", amountCents: -90_000, projectedBalanceCents: 10_000 },
      { id: "bill", date: "2026-09-15", amountCents: -45_000, projectedBalanceCents: -35_000 },
      { id: "income", date: "2026-09-15", amountCents: 200_000, projectedBalanceCents: 165_000 },
    ]);
  });
  it("uses the locked Florida boundary", () => {
    expect(contextForPeriod("2026-06-30")).toBe("georgia-home");
    expect(contextForPeriod("2026-07-01")).toBe("florida-home");
    expect(formatMoney(182_500)).toBe("$1,825.00");
  });
});
