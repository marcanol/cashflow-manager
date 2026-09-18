import { calculateBudgetRemaining } from "../domain/budgets";
import { calculatePlannedSafeToSpend, recommendPayment, type Recommendation } from "../domain/planning";
import { sumCents } from "../domain/money";
import { createSupabaseServerClient } from "../supabase/server";

export type AccountSummary = { id: string; institution: string; name: string; availableBalanceCents: number | null; pendingTransactionCents: number };
export type PaycheckSummary = { id: string; person: string; expectedDate: string; expectedAmountCents: number | null; accountId: string; accountName: string };
export type BudgetSummary = { id: string; name: string; cadence: string; allocationAmountCents: number | null; consumedAmountCents: number; remainingAmountCents: number | null; active: boolean; needsConfiguration: boolean };
export type ObligationSummary = { id: string; name: string; dueDate: string | null; lastSafeDate: string | null; amountCents: number | null; reservedCents: number; paymentMode: "AUTOPAY" | "MANUAL"; accountId: string | null; accountName: string | null; recommendation: Recommendation | null };
export type TodaySnapshot = {
  state: "UNAVAILABLE" | "PARTIAL" | "READY"; reason?: string; asOf: string; safeToSpendCents: number | null;
  accounts: AccountSummary[]; nextPaychecks: PaycheckSummary[]; budgets: BudgetSummary[]; upcoming: ObligationSummary[];
  attention: string[]; reservedObligationCents: number; protectedBudgetRemainingCents: number;
};
export type PlanEvent = { id: string; date: string; kind: "PAYCHECK" | "OBLIGATION" | "BUDGET_PROTECTION"; label: string; amountCents: number | null; accountName: string | null; action: Recommendation["action"] | null; affectsCash: boolean };

const currentIsoDate = () => new Date().toISOString().slice(0, 10);
const monthStart = (date: string) => `${date.slice(0, 7)}-01`;
const addDays = (date: string, days: number) => { const value = new Date(`${date}T00:00:00Z`); value.setUTCDate(value.getUTCDate() + days); return value.toISOString().slice(0, 10); };
const unavailable = (asOf: string, reason: string): TodaySnapshot => ({ state: "UNAVAILABLE", reason, asOf, safeToSpendCents: null, accounts: [], nextPaychecks: [], budgets: [], upcoming: [], attention: [], reservedObligationCents: 0, protectedBudgetRemainingCents: 0 });

/** Reads only through the authenticated session; RLS remains the household boundary. */
export async function getTodaySnapshotFromDatabase(asOf = currentIsoDate()): Promise<TodaySnapshot> {
  const client = await createSupabaseServerClient();
  if (!client) return unavailable(asOf, "Supabase is not configured. No financial values are being guessed.");
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return unavailable(asOf, "Sign in with your approved household email to view cash-flow data.");
  const { data: membership, error: membershipError } = await client.from("household_members").select("household_id").limit(1).maybeSingle();
  if (membershipError || !membership?.household_id) return unavailable(asOf, membershipError?.message ?? "This user is not a household member.");
  const householdId = membership.household_id as string;

  const [accountsResult, sourcesResult, obligationsResult, budgetsResult, settingsResult] = await Promise.all([
    client.from("accounts").select("id,institution,name").eq("household_id", householdId).eq("is_active", true),
    client.from("income_sources").select("id,person_label,destination_account_id,expected_net_amount_cents").eq("household_id", householdId).eq("active", true),
    client.from("obligations").select("id,name,payment_type,paid_from_account_id,configuration_status").eq("household_id", householdId).eq("active", true),
    client.from("budgets").select("id,name,cadence,configured_allocation_cents,funding_account_id,active").eq("household_id", householdId),
    client.from("household_financial_settings").select("safety_buffer_cents").eq("household_id", householdId).maybeSingle(),
  ]);
  const initialError = accountsResult.error ?? sourcesResult.error ?? obligationsResult.error ?? budgetsResult.error ?? settingsResult.error;
  if (initialError) return unavailable(asOf, initialError.message);

  const accountRows = (accountsResult.data ?? []) as Array<{ id: string; institution: string; name: string }>;
  const sourceRows = (sourcesResult.data ?? []) as Array<{ id: string; person_label: string; destination_account_id: string; expected_net_amount_cents: number | null }>;
  const obligationRows = (obligationsResult.data ?? []) as Array<{ id: string; name: string; payment_type: string | null; paid_from_account_id: string | null; configuration_status: string }>;
  const budgetRows = (budgetsResult.data ?? []) as Array<{ id: string; name: string; cadence: string; configured_allocation_cents: number | null; funding_account_id: string | null; active: boolean }>;
  const accountIds = accountRows.map((row) => row.id); const sourceIds = sourceRows.map((row) => row.id); const obligationIds = obligationRows.map((row) => row.id); const budgetIds = budgetRows.map((row) => row.id);
  const horizon = addDays(asOf, 60);

  const [balancesResult, paychecksResult, occurrencesResult, policiesResult, periodsResult] = await Promise.all([
    accountIds.length ? client.from("account_balance_snapshots").select("account_id,balance_as_of,available_balance_cents,pending_transaction_cents").in("account_id", accountIds).lte("balance_as_of", `${asOf}T23:59:59Z`).order("balance_as_of", { ascending: false }) : Promise.resolve({ data: [], error: null }),
    sourceIds.length ? client.from("paycheck_occurrences").select("id,income_source_id,expected_date,expected_amount_cents").in("income_source_id", sourceIds).gte("expected_date", asOf).lte("expected_date", horizon).order("expected_date") : Promise.resolve({ data: [], error: null }),
    obligationIds.length ? client.from("obligation_occurrences").select("id,obligation_id,period,expected_amount_cents,confirmed_amount_cents,due_date,last_safe_date,status").in("obligation_id", obligationIds).gte("period", monthStart(asOf)).lte("period", monthStart(horizon)).neq("status", "PAID") : Promise.resolve({ data: [], error: null }),
    obligationIds.length ? client.from("payment_policies").select("obligation_id,payment_mode,optimizer_enabled").in("obligation_id", obligationIds) : Promise.resolve({ data: [], error: null }),
    budgetIds.length ? client.from("budget_periods").select("id,budget_id,starts_on,ends_on,allocation_amount_cents").in("budget_id", budgetIds).lte("starts_on", asOf).gte("ends_on", asOf) : Promise.resolve({ data: [], error: null }),
  ]);
  const detailError = balancesResult.error ?? paychecksResult.error ?? occurrencesResult.error ?? policiesResult.error ?? periodsResult.error;
  if (detailError) return unavailable(asOf, detailError.message);

  const periodRows = (periodsResult.data ?? []) as Array<{ id: string; budget_id: string; starts_on: string; ends_on: string; allocation_amount_cents: number }>;
  const periodIds = periodRows.map((row) => row.id);
  const consumptionsResult = periodIds.length ? await client.from("budget_consumptions").select("budget_period_id,amount_cents").in("budget_period_id", periodIds) : { data: [], error: null };
  if (consumptionsResult.error) return unavailable(asOf, consumptionsResult.error.message);
  const occurrenceIds = ((occurrencesResult.data ?? []) as Array<{ id: string }>).map((row) => row.id);
  const movementResult = occurrenceIds.length ? await client.from("reserve_movements").select("amount_cents,direction,occurred_on,related_obligation_occurrence_id").in("related_obligation_occurrence_id", occurrenceIds).lte("occurred_on", asOf) : { data: [], error: null };
  if (movementResult.error) return unavailable(asOf, movementResult.error.message);

  const latestBalanceByAccount = new Map<string, { available_balance_cents: number | null; pending_transaction_cents: number }>();
  for (const row of (balancesResult.data ?? []) as Array<{ account_id: string; available_balance_cents: number | null; pending_transaction_cents: number }>) if (!latestBalanceByAccount.has(row.account_id)) latestBalanceByAccount.set(row.account_id, row);
  const accounts: AccountSummary[] = accountRows.map((row) => ({ id: row.id, institution: row.institution, name: row.name, availableBalanceCents: latestBalanceByAccount.get(row.id)?.available_balance_cents ?? null, pendingTransactionCents: latestBalanceByAccount.get(row.id)?.pending_transaction_cents ?? 0 }));
  const accountById = new Map(accounts.map((account) => [account.id, account]));
  const sourceById = new Map(sourceRows.map((source) => [source.id, source]));

  const allPaychecks: PaycheckSummary[] = ((paychecksResult.data ?? []) as Array<{ id: string; income_source_id: string; expected_date: string; expected_amount_cents: number | null }>).flatMap((row) => {
    const source = sourceById.get(row.income_source_id); if (!source) return [];
    return [{ id: row.id, person: source.person_label, expectedDate: row.expected_date, expectedAmountCents: row.expected_amount_cents, accountId: source.destination_account_id, accountName: accountById.get(source.destination_account_id)?.institution ?? "Unknown account" }];
  });
  const nextByPerson = new Map<string, PaycheckSummary>();
  for (const paycheck of allPaychecks) if (!nextByPerson.has(paycheck.person)) nextByPerson.set(paycheck.person, paycheck);
  const nextPaychecks = [...nextByPerson.values()].sort((a, b) => a.expectedDate.localeCompare(b.expectedDate) || a.person.localeCompare(b.person));
  const nextIncomeByAccount = new Map<string, string>();
  for (const paycheck of allPaychecks) if (!nextIncomeByAccount.has(paycheck.accountId)) nextIncomeByAccount.set(paycheck.accountId, paycheck.expectedDate);

  const consumptionRows = (consumptionsResult.data ?? []) as Array<{ budget_period_id: string; amount_cents: number }>;
  const budgets: BudgetSummary[] = budgetRows.map((budget) => {
    const period = periodRows.find((candidate) => candidate.budget_id === budget.id);
    const periodConsumptions = consumptionRows.filter((row) => row.budget_period_id === period?.id);
    const consumed = sumCents(periodConsumptions.map((row) => row.amount_cents));
    const allocation = period?.allocation_amount_cents ?? budget.configured_allocation_cents;
    return { id: budget.id, name: budget.name, cadence: budget.cadence, allocationAmountCents: allocation ?? null, consumedAmountCents: consumed,
      remainingAmountCents: allocation === null || allocation === undefined ? null : calculateBudgetRemaining(allocation, periodConsumptions.map((row) => ({ budgetId: budget.id, amountCents: row.amount_cents }))),
      active: budget.active, needsConfiguration: budget.active && (allocation === null || allocation === undefined) };
  });

  const obligationById = new Map(obligationRows.map((row) => [row.id, row]));
  const policyByObligation = new Map(((policiesResult.data ?? []) as Array<{ obligation_id: string; payment_mode: "AUTOPAY" | "MANUAL"; optimizer_enabled: boolean }>).map((row) => [row.obligation_id, row]));
  const reservedByOccurrence = new Map<string, number>();
  for (const movement of (movementResult.data ?? []) as Array<{ amount_cents: number; direction: "FUND" | "RELEASE"; related_obligation_occurrence_id: string }>) reservedByOccurrence.set(movement.related_obligation_occurrence_id, (reservedByOccurrence.get(movement.related_obligation_occurrence_id) ?? 0) + (movement.direction === "FUND" ? movement.amount_cents : -movement.amount_cents));

  const upcoming: ObligationSummary[] = ((occurrencesResult.data ?? []) as Array<{ id: string; obligation_id: string; period: string; expected_amount_cents: number | null; confirmed_amount_cents: number | null; due_date: string | null; last_safe_date: string | null; status: string }>).map((occurrence) => {
    const obligation = obligationById.get(occurrence.obligation_id); const policy = policyByObligation.get(occurrence.obligation_id);
    const amountCents = occurrence.confirmed_amount_cents ?? occurrence.expected_amount_cents; const account = obligation?.paid_from_account_id ? accountById.get(obligation.paid_from_account_id) : null;
    const reservedCents = Math.max(0, reservedByOccurrence.get(occurrence.id) ?? 0); let recommendation: Recommendation | null = null;
    if (policy && amountCents !== null && (policy.payment_mode === "AUTOPAY" || account?.availableBalanceCents !== null && account?.availableBalanceCents !== undefined)) recommendation = recommendPayment({ paymentMode: policy.payment_mode, amountCents, reservedCents, accountAvailableCents: account?.availableBalanceCents ?? 0, safetyBufferCents: settingsResult.data?.safety_buffer_cents ?? 0, dueDate: occurrence.due_date, lastSafeDate: occurrence.last_safe_date, asOf, nextIncomeDate: obligation?.paid_from_account_id ? nextIncomeByAccount.get(obligation.paid_from_account_id) ?? null : null });
    return { id: occurrence.id, name: obligation?.name ?? "Unresolved obligation", dueDate: occurrence.due_date, lastSafeDate: occurrence.last_safe_date, amountCents, reservedCents, paymentMode: policy?.payment_mode ?? (obligation?.payment_type === "AUTOPAY" ? "AUTOPAY" : "MANUAL"), accountId: obligation?.paid_from_account_id ?? null, accountName: account?.institution ?? null, recommendation };
  }).sort((a, b) => (a.dueDate ?? "9999-12-31").localeCompare(b.dueDate ?? "9999-12-31") || a.name.localeCompare(b.name));

  const attention: string[] = [];
  for (const budget of budgets.filter((item) => item.needsConfiguration)) attention.push(`${budget.name} needs a monthly allocation.`);
  if (accounts.some((account) => account.availableBalanceCents === null)) attention.push("Enter current PNC and Chase available balances to calculate Safe-to-Spend.");
  if (settingsResult.data?.safety_buffer_cents === null || settingsResult.data?.safety_buffer_cents === undefined) attention.push("Set the household safety buffer to calculate Safe-to-Spend.");
  if (sourceRows.some((source) => source.expected_net_amount_cents === null)) attention.push("Expected net paycheck amounts are not configured; paycheck dates remain available.");
  if (upcoming.some((item) => item.amountCents === null)) attention.push("Some variable obligations still need statement-confirmed forecast amounts.");
  const configuredBudgetRemaining = sumCents(budgets.flatMap((budget) => budget.active && budget.remainingAmountCents !== null ? [Math.max(0, budget.remainingAmountCents)] : []));
  const reservedObligationCents = sumCents(upcoming.map((item) => Math.min(item.amountCents ?? item.reservedCents, item.reservedCents)));
  const canCalculate = accounts.length > 0 && accounts.every((account) => account.availableBalanceCents !== null) && settingsResult.data?.safety_buffer_cents !== null && settingsResult.data?.safety_buffer_cents !== undefined;
  let safeToSpendCents: number | null = null;
  if (canCalculate) safeToSpendCents = calculatePlannedSafeToSpend({ availableCashCents: sumCents(accounts.map((account) => account.availableBalanceCents as number)), pendingTransactionCents: sumCents(accounts.map((account) => account.pendingTransactionCents)), protectedBudgetRemainingCents: configuredBudgetRemaining, safetyBufferCents: settingsResult.data?.safety_buffer_cents as number,
    obligations: upcoming.flatMap((item) => item.amountCents === null || !item.accountId ? [] : [{ id: item.id, accountId: item.accountId, amountCents: item.amountCents, reservedCents: item.reservedCents, dueBeforeNextIncome: item.dueDate !== null && item.dueDate < (nextIncomeByAccount.get(item.accountId) ?? "9999-12-31"), reconciled: false }]) }).safeToSpendCents;
  return { state: canCalculate ? "READY" : "PARTIAL", reason: canCalculate ? "Calculated from configured balances, protected obligations, budgets, reserves, and safety buffer." : "Planning data is loaded, but Safe-to-Spend remains unknown until the listed inputs are configured.", asOf, safeToSpendCents, accounts, nextPaychecks, budgets, upcoming, attention, reservedObligationCents, protectedBudgetRemainingCents: configuredBudgetRemaining };
}

export async function getPlanSnapshotFromDatabase(asOf = currentIsoDate()) {
  const today = await getTodaySnapshotFromDatabase(asOf); const events: PlanEvent[] = [];
  for (const paycheck of today.nextPaychecks) events.push({ id: paycheck.id, date: paycheck.expectedDate, kind: "PAYCHECK", label: `${paycheck.person} paycheck`, amountCents: paycheck.expectedAmountCents, accountName: paycheck.accountName, action: null, affectsCash: true });
  for (const obligation of today.upcoming) events.push({ id: obligation.id, date: obligation.dueDate ?? addDays(asOf, 61), kind: "OBLIGATION", label: obligation.name, amountCents: obligation.amountCents === null ? null : -obligation.amountCents, accountName: obligation.accountName, action: obligation.recommendation?.action ?? null, affectsCash: true });
  for (const budget of today.budgets.filter((item) => item.active && item.remainingAmountCents !== null)) events.push({ id: budget.id, date: monthStart(asOf), kind: "BUDGET_PROTECTION", label: `${budget.name} remaining`, amountCents: -(budget.remainingAmountCents as number), accountName: null, action: null, affectsCash: false });
  return { ...today, events: events.sort((a, b) => a.date.localeCompare(b.date) || a.kind.localeCompare(b.kind) || a.id.localeCompare(b.id)) };
}
