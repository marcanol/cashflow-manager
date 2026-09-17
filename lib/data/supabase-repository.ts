import { reviewProposalToItem, type ReviewProposalValues } from "../domain/historical-proposals";
import { sumCents } from "../domain/money";
import { createSupabaseServerClient } from "../supabase/server";

type OccurrenceRow = {
  id: string;
  raw_import_row_id: string | null;
  period: string;
  expected_amount_cents: number | null;
  confirmed_amount_cents: number | null;
  due_date: string | null;
  obligations: { name: string } | { name: string }[] | null;
};
type PaycheckRow = { expected_date: string; expected_amount_cents: number };
type RawRow = { id: string; period: string };
type ProposalRow = { id: string; raw_import_row_id: string; proposed_values: ReviewProposalValues };

export type UpcomingItem = {
  id: string;
  name: string;
  dueDate: string | null;
  amountCents: number | null;
  source: "NORMALIZED_OCCURRENCE" | "REVIEW_REQUIRED_PROPOSAL";
};

export type TodaySnapshot = {
  state: "UNAVAILABLE" | "PARTIAL";
  reason?: string;
  nextPaycheck?: { date: string; amountCents: number } | null;
  upcoming: UpcomingItem[];
  knownAmountTotalCents: number;
  unknownAmountCount: number;
  reviewRequiredCount: number;
};

const unavailable = (reason: string): TodaySnapshot => ({
  state: "UNAVAILABLE",
  reason,
  upcoming: [],
  knownAmountTotalCents: 0,
  unknownAmountCount: 0,
  reviewRequiredCount: 0,
});

function obligationName(value: OccurrenceRow["obligations"]): string {
  if (Array.isArray(value)) return value[0]?.name ?? "Unresolved occurrence";
  return value?.name ?? "Unresolved occurrence";
}

function sortUpcoming(items: UpcomingItem[]): UpcomingItem[] {
  return [...items].sort((left, right) =>
    (left.dueDate ?? "9999-12-31").localeCompare(right.dueDate ?? "9999-12-31")
      || left.name.localeCompare(right.name)
      || left.id.localeCompare(right.id));
}

/**
 * Runtime reads use the authenticated server session. Row-level security enforces
 * household membership; no unauthenticated public read path exists here.
 */
export async function getTodaySnapshotFromDatabase(asOf = "2026-09-01"): Promise<TodaySnapshot> {
  const client = await createSupabaseServerClient();
  if (!client) return unavailable("Supabase is not configured. No financial values are being guessed.");
  const { data: { user }, error: userError } = await client.auth.getUser();
  if (userError || !user) return unavailable("Sign in with your approved household email to view cash-flow data.");

  const [{ data: occurrences, error: occurrenceError }, { data: paychecks, error: paycheckError }, { data: latestRun, error: runError }] = await Promise.all([
    client.from("obligation_occurrences").select("id,raw_import_row_id,period,expected_amount_cents,confirmed_amount_cents,due_date,obligations(name)").eq("period", asOf).order("due_date", { ascending: true }),
    client.from("paycheck_occurrences").select("expected_date,expected_amount_cents").gte("expected_date", asOf).order("expected_date", { ascending: true }).limit(1),
    client.from("import_runs").select("id").eq("status", "IMPORTED").order("completed_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  if (occurrenceError || paycheckError || runError) return unavailable(occurrenceError?.message ?? paycheckError?.message ?? runError?.message ?? "Database read failed.");

  const normalizedRows = (occurrences ?? []) as OccurrenceRow[];
  const normalized: UpcomingItem[] = normalizedRows.map((row) => ({
    id: row.id,
    name: obligationName(row.obligations),
    dueDate: row.due_date,
    amountCents: row.confirmed_amount_cents ?? row.expected_amount_cents,
    source: "NORMALIZED_OCCURRENCE",
  }));

  let proposals: UpcomingItem[] = [];
  if (latestRun?.id) {
    const { data: rawRows, error: rawError } = await client
      .from("raw_import_rows")
      .select("id,period")
      .eq("import_run_id", latestRun.id)
      .eq("period", asOf);
    if (rawError) return unavailable(rawError.message);

    const rows = (rawRows ?? []) as RawRow[];
    const rawIds = rows.map((row) => row.id);
    if (rawIds.length) {
      const { data: proposalRows, error: proposalError } = await client
        .from("normalization_proposals")
        .select("id,raw_import_row_id,proposed_values")
        .in("raw_import_row_id", rawIds)
        .eq("proposal_kind", "OBLIGATION_OCCURRENCE")
        .eq("confidence", "REVIEW_REQUIRED")
        .eq("status", "PENDING");
      if (proposalError) return unavailable(proposalError.message);

      const periodByRawId = new Map(rows.map((row) => [row.id, row.period]));
      const normalizedRawIds = new Set(normalizedRows.flatMap((row) => row.raw_import_row_id ? [row.raw_import_row_id] : []));
      proposals = ((proposalRows ?? []) as ProposalRow[])
        .filter((proposal) => !normalizedRawIds.has(proposal.raw_import_row_id))
        .map((proposal) => reviewProposalToItem({
          id: proposal.id,
          period: periodByRawId.get(proposal.raw_import_row_id) ?? asOf,
          proposedValues: proposal.proposed_values,
        }));
    }
  }

  const upcoming = sortUpcoming([...normalized, ...proposals]);
  const knownAmounts = upcoming.flatMap((item) => item.amountCents === null ? [] : [item.amountCents]);
  const next = (paychecks ?? []) as PaycheckRow[];
  const reviewRequiredCount = proposals.length;
  const reason = reviewRequiredCount
    ? `${reviewRequiredCount} historical rows are shown as independent review-required proposals; none have been promoted or merged. Safe-to-Spend remains unavailable until bank balances and reserves are modeled.`
    : "Imported obligations are available. Safe-to-Spend remains unavailable until bank balances and reserves are modeled.";
  return {
    state: "PARTIAL",
    reason,
    nextPaycheck: next[0] ? { date: next[0].expected_date, amountCents: next[0].expected_amount_cents } : null,
    upcoming,
    knownAmountTotalCents: sumCents(knownAmounts),
    unknownAmountCount: upcoming.length - knownAmounts.length,
    reviewRequiredCount,
  };
}

export async function getPlanSnapshotFromDatabase(period = "2026-09-01") {
  const today = await getTodaySnapshotFromDatabase(period);
  if (today.state === "UNAVAILABLE") return {
    state: today.state,
    reason: today.reason,
    period: "September 2026",
    events: [] as Array<{ id: string; date: string | null; kind: string; amountCents: number | null; source: UpcomingItem["source"] }>,
    knownAmountTotalCents: 0,
    unknownAmountCount: 0,
    reviewRequiredCount: 0,
  };
  return {
    state: "PARTIAL" as const,
    reason: today.reason,
    period: "September 2026",
    events: today.upcoming.map((item) => ({
      id: item.id,
      date: item.dueDate,
      kind: item.name,
      amountCents: item.amountCents === null ? null : -item.amountCents,
      source: item.source,
    })),
    knownAmountTotalCents: today.knownAmountTotalCents,
    unknownAmountCount: today.unknownAmountCount,
    reviewRequiredCount: today.reviewRequiredCount,
  };
}
