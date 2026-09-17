import type { NormalizationProposal, RawImportRow } from "./workbook";

export type AtomicImportPayload = {
  raw_rows: Array<{
    source_sheet: string;
    source_row: number;
    source_range: string;
    period: string;
    context_key: string;
    column_limit: 22;
    raw_values: unknown[];
  }>;
  proposals: Array<{
    raw_row_key: string;
    proposal_kind: "OBLIGATION_OCCURRENCE";
    proposed_values: NormalizationProposal["proposed"];
    confidence: "REVIEW_REQUIRED";
    reason: string;
  }>;
};

export function createAtomicImportPayload(rawRows: RawImportRow[], proposals: NormalizationProposal[]): AtomicImportPayload {
  return {
    raw_rows: rawRows.map((row) => ({
      source_sheet: row.sourceSheet,
      source_row: row.sourceRow,
      source_range: row.sourceRange,
      period: row.period,
      context_key: row.contextKey,
      column_limit: 22,
      raw_values: row.rawValues,
    })),
    proposals: proposals.map((proposal) => ({
      raw_row_key: proposal.rawRowKey,
      proposal_kind: proposal.proposalKind,
      proposed_values: proposal.proposed,
      confidence: proposal.confidence,
      reason: proposal.reason,
    })),
  };
}

function sqlLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

/**
 * Generates a single-transaction payload suitable for Supabase SQL Editor or psql.
 * The returned SQL contains source financial data and must remain outside Git.
 */
export function buildAtomicImportSql(input: {
  householdId: string;
  sourceWorkbook: string;
  sourceSha256: string;
  payload: AtomicImportPayload;
}): string {
  if (!/^[0-9a-f]{64}$/i.test(input.sourceSha256)) throw new Error("sourceSha256 must be a 64-character hexadecimal SHA-256 digest.");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(input.householdId)) throw new Error("HOUSEHOLD_ID must be a valid UUID.");

  const payloadJson = JSON.stringify(input.payload);
  return [
    "-- Generated financial import payload. Keep this file outside Git.",
    "begin;",
    "select public.import_checkpoint0_workbook(",
    `  ${sqlLiteral(input.householdId)}::uuid,`,
    `  ${sqlLiteral(input.sourceWorkbook)}::text,`,
    `  ${sqlLiteral(input.sourceSha256.toLowerCase())}::text,`,
    `  ${sqlLiteral(payloadJson)}::jsonb`,
    ");",
    "commit;",
    "",
  ].join("\n");
}
