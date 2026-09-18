import { readFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { assertCheckpoint1Config } from "../lib/config/checkpoint1-config";

const configPath = process.argv[2];
if (!configPath) throw new Error("Usage: npm run config:checkpoint1 -- /absolute/path/to/private-config.json [from] [through]");
const config = JSON.parse(await readFile(configPath, "utf8"));
assertCheckpoint1Config(config);

const url = process.env.SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const householdId = process.env.HOUSEHOLD_ID;
if (!url || !secret || !householdId) throw new Error("SUPABASE_URL, SUPABASE_SECRET_KEY, and HOUSEHOLD_ID are required and must remain outside Git.");

const client = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: applied, error: applyError } = await client.rpc("apply_checkpoint1_config", { p_household_id: householdId, p_config: config });
if (applyError) throw applyError;
const { data: generated, error: generationError } = await client.rpc("generate_paycheck_occurrences", {
  p_household_id: householdId,
  p_from: process.argv[3] ?? "2026-09-01",
  p_through: process.argv[4] ?? "2026-11-30",
});
if (generationError) throw generationError;
console.log(JSON.stringify({ applied, generated }, null, 2));
