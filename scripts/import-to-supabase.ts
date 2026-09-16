import { createClient } from "@supabase/supabase-js";
import { resolve, basename } from "node:path";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { importWorkbook } from "../lib/importer/workbook";

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("Usage: npm run import:supabase -- /absolute/path/to/bills.xlsx");
const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required; do not store them in Git.");
const client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
const absolutePath = resolve(sourcePath);
const contents = await readFile(absolutePath);
const sourceSha256 = createHash("sha256").update(contents).digest("hex");
const result = importWorkbook(absolutePath);
const householdId = process.env.HOUSEHOLD_ID || null;

const { data: run, error: runError } = await client.from("import_runs").insert({ household_id: householdId, source_workbook: basename(absolutePath), source_sha256: sourceSha256, status: "REHEARSAL" }).select("id").single();
if (runError || !run) throw new Error(`Could not create import run: ${runError?.message}`);
try {
  const rows = result.rawRows.map((row) => ({ import_run_id: run.id, source_sheet: row.sourceSheet, source_row: row.sourceRow, source_range: row.sourceRange, period: row.period, context_key: row.contextKey, column_limit: 22, raw_values: row.rawValues }));
  const inserted: { id: string; source_sheet: string; source_row: number }[] = [];
  for (let index = 0; index < rows.length; index += 500) {
    const { data, error } = await client.from("raw_import_rows").insert(rows.slice(index, index + 500)).select("id,source_sheet,source_row");
    if (error) throw new Error(`Could not insert raw import rows: ${error.message}`);
    inserted.push(...(data ?? []));
  }
  const ids = new Map(inserted.map((row) => [`${row.source_sheet}:${row.source_row}`, row.id]));
  const proposals = result.proposals.flatMap((proposal) => {
    const rawImportRowId = ids.get(proposal.rawRowKey);
    return rawImportRowId ? [{ raw_import_row_id: rawImportRowId, proposal_kind: proposal.proposalKind, proposed_values: proposal.proposed, confidence: proposal.confidence, reason: proposal.reason }] : [];
  });
  for (let index = 0; index < proposals.length; index += 500) {
    const { error } = await client.from("normalization_proposals").insert(proposals.slice(index, index + 500));
    if (error) throw new Error(`Could not insert normalization proposals: ${error.message}`);
  }
  const { error: finishError } = await client.from("import_runs").update({ status: "IMPORTED", completed_at: new Date().toISOString() }).eq("id", run.id);
  if (finishError) throw new Error(`Could not finish import run: ${finishError.message}`);
  console.log(JSON.stringify({ importRunId: run.id, rawRows: rows.length, proposals: proposals.length, selectedSheets: result.selectedSheets.map((sheet) => sheet.name) }, null, 2));
} catch (error) {
  await client.from("import_runs").update({ status: "FAILED", completed_at: new Date().toISOString() }).eq("id", run.id);
  throw error;
}
