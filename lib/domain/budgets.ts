import { assertCents, sumCents } from "./money";

export type BudgetDefinition = { id: string; active: boolean };
export type BudgetConsumption = { budgetId: string; amountCents: number };

export function calculateBudgetRemaining(allocationAmountCents: number, consumptions: BudgetConsumption[]): number {
  const allocation = assertCents(allocationAmountCents);
  const consumed = sumCents(consumptions.map((item) => {
    if (item.amountCents <= 0) throw new Error("Budget consumption must be positive.");
    return item.amountCents;
  }));
  return assertCents(allocation - consumed);
}

export function validateBudgetAllocation(
  budgets: BudgetDefinition[],
  budgetId: string,
  amountCents: number,
): BudgetDefinition {
  const budget = budgets.find((candidate) => candidate.id === budgetId);
  if (!budget) throw new Error("Select an existing budget before allocating a transaction.");
  if (!budget.active) throw new Error("Transactions may be allocated only to an active budget.");
  if (assertCents(amountCents) <= 0) throw new Error("Budget allocation must be positive.");
  return budget;
}
