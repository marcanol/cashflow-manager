import { resolve } from "node:path";
import { importWorkbook } from "../lib/importer/workbook";

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("Usage: npm run import:workbook -- /absolute/path/to/bills.xlsx [output.json]");
const result = importWorkbook(resolve(sourcePath));
const output = JSON.stringify({ selectedSheets: result.selectedSheets, rawRowCount: result.rawRows.length, proposalCount: result.proposals.length, rawRows: result.rawRows, proposals: result.proposals }, null, 2);
const outputPath = process.argv[3];
if (outputPath) await import("node:fs/promises").then(({ writeFile }) => writeFile(resolve(outputPath), output)); else process.stdout.write(`${output}\n`);
