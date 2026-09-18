import { assertCents, sumCents } from "./money";

export type ProtectedObligation = {
  id: string;
  accountId: string;
  amountCents: number;
  reservedCents: number;
  dueBeforeNextIncome: boolean;
  reconciled: boolean;
};

export type SafeToSpendPlan = {
  availableCashCents: number;
  pendingTransactionCents: number;
  protectedBudgetRemainingCents: number;
  safetyBufferCents: number;
  obligations: ProtectedObligation[];
};

export type SafeToSpendResult = {
  safeToSpendCents: number;
  reservedObligationCents: number;
  unfundedRequiredObligationCents: number;
};

export function calculatePlannedSafeToSpend(input: SafeToSpendPlan): SafeToSpendResult {
  const outstanding = input.obligations.filter((item) => !item.reconciled);
  const reservedObligationCents = sumCents(outstanding.map((item) => Math.min(assertCents(item.amountCents), assertCents(item.reservedCents))));
  const unfundedRequiredObligationCents = sumCents(outstanding.map((item) => item.dueBeforeNextIncome
    ? Math.max(0, assertCents(item.amountCents) - Math.min(assertCents(item.amountCents), assertCents(item.reservedCents)))
    : 0));
  return {
    safeToSpendCents: assertCents(
      assertCents(input.availableCashCents)
      - assertCents(input.pendingTransactionCents)
      - reservedObligationCents
      - unfundedRequiredObligationCents
      - assertCents(input.protectedBudgetRemainingCents)
      - assertCents(input.safetyBufferCents),
    ),
    reservedObligationCents,
    unfundedRequiredObligationCents,
  };
}

export type RecommendationInput = {
  paymentMode: "AUTOPAY" | "MANUAL";
  amountCents: number;
  reservedCents: number;
  accountAvailableCents: number;
  safetyBufferCents: number;
  dueDate: string | null;
  lastSafeDate: string | null;
  asOf: string;
  nextIncomeDate: string | null;
};

export type Recommendation = { action: "PAY" | "RESERVE" | "HOLD"; amountCents: number; reasonCode: string };

export function recommendPayment(input: RecommendationInput): Recommendation {
  const amount = assertCents(input.amountCents);
  const reserved = Math.min(amount, assertCents(input.reservedCents));
  const remainingToProtect = assertCents(amount - reserved);
  if (input.paymentMode === "AUTOPAY") {
    return remainingToProtect > 0
      ? { action: "RESERVE", amountCents: remainingToProtect, reasonCode: "AUTOPAY_NEEDS_PROTECTION" }
      : { action: "HOLD", amountCents: amount, reasonCode: "AUTOPAY_ALREADY_PROTECTED" };
  }
  const decisionDate = input.lastSafeDate ?? input.dueDate;
  const mustActBeforeIncome = decisionDate !== null && (input.nextIncomeDate === null || decisionDate < input.nextIncomeDate);
  const canPay = assertCents(input.accountAvailableCents) - amount >= assertCents(input.safetyBufferCents);
  if (canPay && (decisionDate === null || decisionDate <= input.asOf || mustActBeforeIncome)) {
    return { action: "PAY", amountCents: amount, reasonCode: "PAYMENT_DUE_AND_LIQUID" };
  }
  if (remainingToProtect > 0 && mustActBeforeIncome) {
    return { action: "RESERVE", amountCents: remainingToProtect, reasonCode: "PROTECT_BEFORE_NEXT_INCOME" };
  }
  return { action: "HOLD", amountCents: amount, reasonCode: "WAIT_FOR_LATER_CASH_EVENT" };
}
