import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("supabase/migrations/20260918000000_checkpoint_1_planning.sql"), "utf8");
const tables = ["household_financial_settings", "payment_policies", "account_balance_snapshots", "budgets", "budget_periods", "budget_consumptions", "reserves", "reserve_movements"];

describe("Checkpoint 1 schema", () => {
  it("persists recurrence configuration instead of hardcoding paycheck dates in UI", () => {
    expect(migration).toContain("recurrence_type");
    expect(migration).toContain("interval_days");
    expect(migration).toContain("anchor_date");
    expect(migration).toContain("days_of_month");
    expect(migration).toContain("date_adjustment_policy");
    expect(migration).toContain("generate_paycheck_occurrences");
  });

  it("models budgets, split-ready consumption, reserves, and payment policies", () => {
    expect(migration).toContain("create table budgets");
    expect(migration).toContain("create table budget_periods");
    expect(migration).toContain("create table budget_consumptions");
    expect(migration).toContain("source_transaction_reference");
    expect(migration).toContain("create table reserves");
    expect(migration).toContain("create table reserve_movements");
    expect(migration).toContain("create table payment_policies");
  });

  it("enables and forces RLS on every new financial table", () => {
    for (const table of tables) {
      expect(migration).toContain(`alter table ${table} enable row level security;`);
      expect(migration).toContain(`alter table ${table} force row level security;`);
    }
  });

  it("limits browser writes to the owner-checked budget RPC", () => {
    expect(migration).toContain("private.is_household_owner");
    expect(migration).toContain("save_budget_definition");
    expect(migration).toContain("grant execute on function public.save_budget_definition");
    expect(migration).not.toContain("grant insert, update on table budgets to authenticated");
    expect(migration).not.toContain("grant all on table");
  });

  it("keeps private configuration loaders server-only", () => {
    expect(migration).toContain("apply_checkpoint1_config");
    expect(migration).toContain("revoke all on function public.apply_checkpoint1_config(uuid, jsonb) from public, anon, authenticated");
    expect(migration).toContain("grant execute on function public.apply_checkpoint1_config(uuid, jsonb) to service_role");
    expect(migration).toContain("revoke all on function public.generate_paycheck_occurrences(uuid, date, date) from public, anon, authenticated");
  });

  it("prevents autopay from carrying optimizer-controlled late-fee behavior", () => {
    expect(migration).toContain("payment_mode <> 'AUTOPAY'");
    expect(migration).toContain("late_fee_type = 'NONE'");
    expect(migration).toContain("optimizer_enabled = false");
  });
});
