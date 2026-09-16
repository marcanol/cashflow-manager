import { assertCents, sumCents } from "./money";

export type CashflowInputs = {
  availableCashCents: number;
  pendingTransactionCents: number;
  reservedObligationCents: number;
  protectedAllocationCents: number;
  requiredBillsBeforeIncomeCents: number;
  safetyBufferCents: number;
};

/** Checkpoint 0 formula; inputs must be independently sourced and non-overlapping. */
export function calculateSafeToSpend(inputs: CashflowInputs): number {
  const deductions = sumCents([
    inputs.pendingTransactionCents, inputs.reservedObligationCents, inputs.protectedAllocationCents,
    inputs.requiredBillsBeforeIncomeCents, inputs.safetyBufferCents,
  ]);
  return assertCents(assertCents(inputs.availableCashCents) - deductions);
}

export type DailyEvent = { id: string; date: string; amountCents: number };
export function projectDailyBalances(openingBalanceCents: number, events: DailyEvent[]) {
  let balance = assertCents(openingBalanceCents);
  return [...events].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).map((event) => {
    balance = assertCents(balance + assertCents(event.amountCents));
    return { ...event, projectedBalanceCents: balance };
  });
}
