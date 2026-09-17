import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(resolve("supabase/migrations/20260917000000_auth_and_household_rls.sql"), "utf8");
const protectedTables = ["households", "household_members", "financial_contexts", "accounts", "income_sources", "paycheck_occurrences", "import_runs", "raw_import_rows", "obligations", "obligation_aliases", "obligation_occurrences", "normalization_proposals", "planned_allocations"];

describe("Checkpoint 0 tenant security schema", () => {
  it("enables and forces RLS on every Checkpoint 0 table", () => {
    for (const table of protectedTables) {
      expect(migration).toContain(`alter table ${table} enable row level security;`);
      expect(migration).toContain(`alter table ${table} force row level security;`);
    }
  });
  it("has a membership boundary and protects transitive import/obligation data", () => {
    expect(migration).toContain("create table household_members");
    expect(migration).toContain("private.is_household_member");
    expect(migration).toContain("raw_row_household_access");
    expect(migration).toContain("proposal_household_access");
    expect(migration).toContain("allocation_household_access");
    expect(migration).toContain("alter table import_runs alter column household_id set not null;");
  });
  it("revokes anonymous access and exposes read-only data to authenticated members", () => {
    expect(migration).toContain("from anon, authenticated;");
    expect(migration).toContain("to authenticated;");
    expect(migration).not.toContain(" for all to authenticated");
    expect(migration).not.toContain(" for insert to authenticated");
  });
  it("pins the security-definer search path and indexes membership lookup", () => {
    expect(migration).toContain("security definer set search_path = ''");
    expect(migration).toContain("household_members_user_id_idx");
    expect(migration).toContain("user_id = (select auth.uid())");
  });
});
