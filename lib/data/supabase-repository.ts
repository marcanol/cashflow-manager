import { createSupabaseServerClient } from "../supabase/server";

type OccurrenceRow = { id: string; period: string; expected_amount_cents: number | null; confirmed_amount_cents: number | null; due_date: string | null; obligations: { name: string }[] | null };
type PaycheckRow = { expected_date: string; expected_amount_cents: number };

export type TodaySnapshot = {
  state: "UNAVAILABLE" | "PARTIAL";
  reason?: string;
  nextPaycheck?: { date: string; amountCents: number } | null;
  upcoming: { id: string; name: string; dueDate: string; amountCents: number }[];
};

/**
 * Runtime reads use the authenticated server session. Row-level security enforces
 * household membership; no unauthenticated public read path exists here.
 */
export async function getTodaySnapshotFromDatabase(asOf = "2026-09-01"): Promise<TodaySnapshot> {
  const client = await createSupabaseServerClient();
  if (!client) return { state: "UNAVAILABLE", reason: "Supabase is not configured. No financial values are being guessed.", upcoming: [] };
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return { state: "UNAVAILABLE", reason: "Sign in with your approved household email to view cash-flow data.", upcoming: [] };
  const [{ data: occurrences, error: occurrenceError }, { data: paychecks, error: paycheckError }] = await Promise.all([
    client.from("obligation_occurrences").select("id,period,expected_amount_cents,confirmed_amount_cents,due_date,obligations(name)").gte("period", asOf).order("due_date", { ascending: true }).limit(8),
    client.from("paycheck_occurrences").select("expected_date,expected_amount_cents").gte("expected_date", asOf).order("expected_date", { ascending: true }).limit(1),
  ]);
  if (occurrenceError || paycheckError) return { state: "UNAVAILABLE", reason: occurrenceError?.message ?? paycheckError?.message, upcoming: [] };
  const upcoming = ((occurrences ?? []) as OccurrenceRow[]).map((row) => ({ id: row.id, name: row.obligations?.[0]?.name ?? "Unresolved import row", dueDate: row.due_date ?? row.period, amountCents: row.confirmed_amount_cents ?? row.expected_amount_cents ?? 0 }));
  const next = (paychecks ?? []) as PaycheckRow[];
  // Bank balances/reserves have no source in Checkpoint 0; never substitute zero for unknown money.
  return { state: "PARTIAL", reason: "Imported obligations are available. Safe-to-Spend remains unavailable until bank balances and reserves are modeled.", nextPaycheck: next[0] ? { date: next[0].expected_date, amountCents: next[0].expected_amount_cents } : null, upcoming };
}

export async function getPlanSnapshotFromDatabase(period = "2026-09-01") {
  const today = await getTodaySnapshotFromDatabase(period);
  if (today.state === "UNAVAILABLE") return { state: today.state, reason: today.reason, period: "September 2026", events: [] as { id: string; date: string; kind: string; amountCents: number }[] };
  return { state: "PARTIAL" as const, reason: today.reason, period: "September 2026", events: today.upcoming.map((item) => ({ id: item.id, date: item.dueDate, kind: item.name, amountCents: -item.amountCents })) };
}
