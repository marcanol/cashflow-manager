import { createClient } from "@supabase/supabase-js";
import { resolve, basename } from "node:path";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { createAtomicImportPayload } from "../lib/importer/atomic-payload";
import { importWorkbook } from "../lib/importer/workbook";

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("Usage: npm run import:supabase -- /absolute/path/to/bills.xlsx");
const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) throw new Error("SUPABASE_URL and SUPABASE_SECRET_KEY (or legacy SUPABASE_SERVICE_ROLE_KEY) are required; do not store them in Git.");
const client = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
const absolutePath = resolve(sourcePath);
const contents = await readFile(absolutePath);
const sourceSha256 = createHash("sha256").update(contents).digest("hex");
const result = importWorkbook(absolutePath);
const householdId = process.env.HOUSEHOLD_ID;
if (!householdId) throw new Error("HOUSEHOLD_ID is required so every imported row has an authorized household owner.");

const { data, error } = await client.rpc("import_checkpoint0_workbook", {
  p_household_id: householdId,
  p_source_workbook: basename(absolutePath),
  p_source_sha256: sourceSha256,
  p_payload: createAtomicImportPayload(result.rawRows, result.proposals),
});
if (error) throw new Error(`Atomic workbook import failed: ${error.message}`);
console.log(JSON.stringify({ result: data, selectedSheets: result.selectedSheets.map((sheet) => sheet.name) }, null, 2));
