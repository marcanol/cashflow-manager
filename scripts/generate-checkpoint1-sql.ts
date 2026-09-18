import { createHash } from "node:crypto";
import { chmod, readFile, writeFile } from "node:fs/promises";
import { assertCheckpoint1Config } from "../lib/config/checkpoint1-config";

const [configPath, outputPath, from = "2026-09-01", through = "2026-11-30"] = process.argv.slice(2);
const householdId = process.env.HOUSEHOLD_ID;
if (!configPath || !outputPath || !householdId) throw new Error("Usage: HOUSEHOLD_ID=... npm run config:sql -- private-config.json /tmp/checkpoint1.import.sql [from] [through]");
const raw = await readFile(configPath, "utf8");
const config = JSON.parse(raw);
assertCheckpoint1Config(config);
const tag = `checkpoint1_${createHash("sha256").update(raw).digest("hex").slice(0, 12)}`;
const sql = `begin;\nselect public.apply_checkpoint1_config('${householdId}'::uuid, $${tag}$${JSON.stringify(config)}$${tag}$::jsonb);\nselect public.generate_paycheck_occurrences('${householdId}'::uuid, '${from}'::date, '${through}'::date);\ncommit;\n`;
await writeFile(outputPath, sql, { mode: 0o600 });
await chmod(outputPath, 0o600);
console.log(JSON.stringify({ outputPath, bytes: Buffer.byteLength(sql), containsPrivateFinancialData: true }));
