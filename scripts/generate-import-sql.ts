import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import { buildAtomicImportSql, createAtomicImportPayload } from "../lib/importer/atomic-payload";
import { importWorkbook } from "../lib/importer/workbook";

const sourcePath = process.argv[2];
const outputPath = process.argv[3];
if (!sourcePath || !outputPath) throw new Error("Usage: npm run import:sql -- /absolute/path/to/bills.xlsx /outside/repository/import.sql");
const householdId = process.env.HOUSEHOLD_ID;
if (!householdId) throw new Error("HOUSEHOLD_ID is required.");

const absoluteSource = resolve(sourcePath);
const absoluteOutput = resolve(outputPath);
const repositoryRoot = resolve(process.cwd());
const outputRelativeToRepository = relative(repositoryRoot, absoluteOutput);
if (outputRelativeToRepository === "" || (!outputRelativeToRepository.startsWith("..") && !outputRelativeToRepository.startsWith("/"))) {
  throw new Error("The generated SQL contains private financial data and must be written outside the Git repository.");
}

const contents = await readFile(absoluteSource);
const result = importWorkbook(absoluteSource);
const sourceSha256 = createHash("sha256").update(contents).digest("hex");
const sql = buildAtomicImportSql({
  householdId,
  sourceWorkbook: basename(absoluteSource),
  sourceSha256,
  payload: createAtomicImportPayload(result.rawRows, result.proposals),
});
await writeFile(absoluteOutput, sql, { encoding: "utf8", mode: 0o600 });
process.stdout.write(`${JSON.stringify({ output: absoluteOutput, sourceSha256, rawRows: result.rawRows.length, proposals: result.proposals.length, selectedSheets: result.selectedSheets.map((sheet) => sheet.name) }, null, 2)}\n`);
