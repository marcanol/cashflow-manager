import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildAtomicImportSql, createAtomicImportPayload } from "../lib/importer/atomic-payload";
import type { NormalizationProposal, RawImportRow } from "../lib/importer/workbook";

const migration = readFileSync(resolve("supabase/migrations/20260917120000_atomic_historical_import.sql"), "utf8");

const rawRows: RawImportRow[] = [{
  sourceWorkbook: "bills.xlsx",
  sourceSheet: "Sep 2026",
  sourceRow: 2,
  sourceRange: "A2:V2",
  rawValues: ["Owner's Insurance", "15th", "$1,234.56"],
  period: "2026-09-01",
  contextKey: "florida-home",
}];
const proposals: NormalizationProposal[] = [{
  rawRowKey: "Sep 2026:2",
  proposalKind: "OBLIGATION_OCCURRENCE",
  rawName: "Owner's Insurance",
  period: "2026-09-01",
  contextKey: "florida-home",
  proposed: { name: "Owner's Insurance", expectedAmountText: "$1,234.56", dueDateText: "15th" },
  confidence: "REVIEW_REQUIRED",
  reason: "Independent source row.",
}];

describe("atomic historical import", () => {
  it("maps the existing importer output without altering provenance or proposal confidence", () => {
    expect(createAtomicImportPayload(rawRows, proposals)).toEqual({
      raw_rows: [{ source_sheet: "Sep 2026", source_row: 2, source_range: "A2:V2", period: "2026-09-01", context_key: "florida-home", column_limit: 22, raw_values: ["Owner's Insurance", "15th", "$1,234.56"] }],
      proposals: [{ raw_row_key: "Sep 2026:2", proposal_kind: "OBLIGATION_OCCURRENCE", proposed_values: { name: "Owner's Insurance", expectedAmountText: "$1,234.56", dueDateText: "15th" }, confidence: "REVIEW_REQUIRED", reason: "Independent source row." }],
    });
  });

  it("generates one explicit SQL transaction and safely quotes source text", () => {
    const sql = buildAtomicImportSql({
      householdId: "d7e1719c-c1ba-48a1-9b63-996633b49208",
      sourceWorkbook: "bills.xlsx",
      sourceSha256: "a".repeat(64),
      payload: createAtomicImportPayload(rawRows, proposals),
    });
    expect(sql).toContain("begin;");
    expect(sql).toContain("select public.import_checkpoint0_workbook(");
    expect(sql).toContain("Owner''s Insurance");
    expect(sql).toContain("commit;");
  });

  it("uses source-SHA replay protection and a service-role-only atomic function", () => {
    expect(migration).toContain("import_runs_household_source_sha256_uidx");
    expect(migration).toContain("on conflict (household_id, source_sha256)");
    expect(migration).toContain("'alreadyImported', true");
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("p_source_sha256 is null or p_source_sha256 !~ '^[0-9a-f]{64}$'");
    expect(migration).toContain("revoke all on function public.import_checkpoint0_workbook(uuid, text, text, jsonb) from public, anon, authenticated;");
    expect(migration).toContain("grant execute on function public.import_checkpoint0_workbook(uuid, text, text, jsonb) to service_role;");
    expect(migration).not.toContain("insert into public.obligations");
    expect(migration).not.toContain("insert into public.obligation_occurrences");
  });
});
