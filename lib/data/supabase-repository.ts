import { createClient } from "@supabase/supabase-js";
import { calculateSafeToSpend } from "../domain/cashflow";

type OccurrenceRow = { id: string; period: string; expected_amount_cents: number | null; confirmed_amount_cents: number | null; due_date: string | null; obligations: { name: string }[] | null };
type PaycheckRow = { expected_date: string; expected_amount_cents: number };

export type TodaySnapshot = {
  state: "UNAVAILABLE" | "READY";
  reason?: string;
  safeToSpendCents?: number;
  availableCashCents?: number;
  reservedCents?: number;
  nextPaycheck?: { date: string; amountCents: number } | null;
  upcoming: { id: string; name: string; dueDate: string; amountCents: number }[];
};

function configuredClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key, { auth: { persistSession: false } }) : null;
}

/**
 * Runtime data access is separated from UI. Checkpoint 0 intentionally returns an
 * explicit unavailable state until actual bank balances/imported data are configured.
 */
export async function getTodaySnapshotFromDatabase(asOf = "2026-09-01"): Promise<TodaySnapshot> {
  const client = configuredClient();
  if (!client) return { state: "UNAVAILABLE", reason: "Supabase is not configured. No financial values are being guessed.", upcoming: [] };
  const [{ data: occurrences, error: occurrenceError }, { data: paychecks, error: paycheckError }] = await Promise.all([
    client.from("obligation_occurrences").select("id,period,expected_amount_cents,confirmed_amount_cents,due_date,obligations(name)").gte("period", asOf).order("due_date", { ascending: true }).limit(8),
    client.from("paycheck_occurrences").select("expected_date,expected_amount_cents").gte("expected_date", asOf).order("expected_date", { ascending: true }).limit(1),
  ]);
  if (occurrenceError || paycheckError) return { state: "UNAVAILABLE", reason: occurrenceError?.message ?? paycheckError?.message, upcoming: [] };
  const upcoming = ((occurrences ?? []) as OccurrenceRow[]).map((row) => ({ id: row.id, name: row.obligations?.[0]?.name ?? "Unresolved import row", dueDate: row.due_date ?? row.period, amountCents: row.confirmed_amount_cents ?? row.expected_amount_cents ?? 0 }));
  const next = (paychecks ?? []) as PaycheckRow[];
  // Bank available balance/reserves are intentionally unavailable at Checkpoint 0.
  return { state: "READY", availableCashCents: 0, reservedCents: 0, safeToSpendCents: calculateSafeToSpend({ availableCashCents: 0, pendingTransactionCents: 0, reservedObligationCents: 0, protectedAllocationCents: 0, requiredBillsBeforeIncomeCents: 0, safetyBufferCents: 0 }), nextPaycheck: next[0] ? { date: next[0].expected_date, amountCents: next[0].expected_amount_cents } : null, upcoming };
}

export async function getPlanSnapshotFromDatabase(period = "2026-09-01") {
  const today = await getTodaySnapshotFromDatabase(period);
  if (today.state === "UNAVAILABLE") return { state: today.state, reason: today.reason, period: "September 2026", events: [] as { id: string; date: string; kind: string; amountCents: number }[] };
  return { state: "READY" as const, period: "September 2026", events: today.upcoming.map((item) => ({ id: item.id, date: item.dueDate, kind: item.name, amountCents: -item.amountCents })) };
}
