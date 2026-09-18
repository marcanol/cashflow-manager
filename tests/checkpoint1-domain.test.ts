import { describe, expect, it } from "vitest";
import { calculateBudgetRemaining, validateBudgetAllocation } from "../lib/domain/budgets";
import { generateExpectedPaychecks } from "../lib/domain/income";
import { calculatePlannedSafeToSpend, recommendPayment } from "../lib/domain/planning";

describe("Checkpoint 1 income generation", () => {
  it("generates Luis's exact 14-day Friday cadence from the confirmed anchor", () => {
    const result = generateExpectedPaychecks({ recurrenceType: "INTERVAL_DAYS", intervalDays: 14, anchorDate: "2026-09-25" }, "2026-09-01", "2026-11-06");
    expect(result.occurrences.map((item) => item.expectedDate)).toEqual(["2026-09-25", "2026-10-09", "2026-10-23", "2026-11-06"]);
  });

  it("generates Anamary's 15th/30th schedule and preserves an unresolved invalid day policy", () => {
    const result = generateExpectedPaychecks({ recurrenceType: "MONTH_DAYS", daysOfMonth: [15, 30], dateAdjustmentPolicy: null }, "2026-09-01", "2026-10-31");
    expect(result.occurrences.map((item) => item.expectedDate)).toEqual(["2026-09-15", "2026-09-30", "2026-10-15", "2026-10-30"]);
    expect(generateExpectedPaychecks({ recurrenceType: "MONTH_DAYS", daysOfMonth: [15, 30], dateAdjustmentPolicy: null }, "2027-02-01", "2027-02-28").unresolvedDates).toEqual(["2027-02-30"]);
  });
});

describe("Checkpoint 1 budgets", () => {
  const budgets = [{ id: "food", active: true }, { id: "old", active: false }];
  it("reduces remaining budget and permits split transaction allocations", () => {
    expect(calculateBudgetRemaining(60_00, [{ budgetId: "pool", amountCents: 18_00 }, { budgetId: "pool", amountCents: 7_50 }])).toBe(34_50);
  });
  it("refuses nonexistent and inactive budgets", () => {
    expect(() => validateBudgetAllocation(budgets, "missing", 100)).toThrow(/existing budget/);
    expect(() => validateBudgetAllocation(budgets, "old", 100)).toThrow(/active budget/);
    expect(validateBudgetAllocation(budgets, "food", 100).id).toBe("food");
  });
});

describe("Checkpoint 1 deterministic planning", () => {
  it("does not double-count a partially reserved obligation", () => {
    const result = calculatePlannedSafeToSpend({
      availableCashCents: 500_000,
      pendingTransactionCents: 10_000,
      protectedBudgetRemainingCents: 30_000,
      safetyBufferCents: 50_000,
      obligations: [{ id: "mortgage", accountId: "pnc", amountCents: 100_000, reservedCents: 40_000, dueBeforeNextIncome: true, reconciled: false }],
    });
    expect(result).toEqual({ safeToSpendCents: 310_000, reservedObligationCents: 40_000, unfundedRequiredObligationCents: 60_000 });
  });

  it("removes a reconciled obligation from protected deductions", () => {
    expect(calculatePlannedSafeToSpend({ availableCashCents: 100_000, pendingTransactionCents: 0, protectedBudgetRemainingCents: 0, safetyBufferCents: 0, obligations: [{ id: "paid", accountId: "pnc", amountCents: 50_000, reservedCents: 50_000, dueBeforeNextIncome: true, reconciled: true }] }).safeToSpendCents).toBe(100_000);
  });

  it("reserves autopay and uses PAY/RESERVE/HOLD deterministically for manual items", () => {
    expect(recommendPayment({ paymentMode: "AUTOPAY", amountCents: 10_000, reservedCents: 4_000, accountAvailableCents: 0, safetyBufferCents: 0, dueDate: "2026-09-20", lastSafeDate: null, asOf: "2026-09-18", nextIncomeDate: "2026-09-25" })).toEqual({ action: "RESERVE", amountCents: 6_000, reasonCode: "AUTOPAY_NEEDS_PROTECTION" });
    expect(recommendPayment({ paymentMode: "MANUAL", amountCents: 10_000, reservedCents: 0, accountAvailableCents: 50_000, safetyBufferCents: 20_000, dueDate: "2026-09-20", lastSafeDate: "2026-09-20", asOf: "2026-09-18", nextIncomeDate: "2026-09-25" }).action).toBe("PAY");
  });
});
