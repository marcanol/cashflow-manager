# Current State

## Status
Checkpoint 0 remains complete. Checkpoint 1 is implemented and validated locally, but is not yet complete in the live environment: the secure Supabase dashboard sign-in expired before the migration and private configuration load. No live Checkpoint 1 database changes were made. The repository contains only generic schema, deterministic logic, UI, tests, and import tooling; the completed worksheet and normalized household configuration remain outside Git.

## Locked inputs
- `bills.xlsx` is the historical source.
- Only month/year tabs are relevant.
- Ignore W onward.
- Active history target is approximately 24 months.
- Florida/current-home context begins May 2026.
- Net deposited income only.
- Luis: exactly every 14 days from 2026-09-25 → PNC.
- Anamary: 15th and 30th → Chase; invalid-30th adjustment remains unresolved/configurable.
- Product should minimize human-in-the-loop work.
- Initial UI should be Xero-simple and replaceable.
- Launch begins with one approved household `OWNER`; additional household members may be added after go-live without changing the tenancy model.
- Local Cashflow Manager development and production-mode verification use `http://localhost:3001`; Attendly retains port 3000.

## Implemented in Checkpoint 0
- Next.js app with minimal Today and Plan routes backed by a Supabase repository. When its environment variables are absent, it displays an explicit unavailable state rather than invented money.
- Supabase migration for household/context/account/income/import provenance/normalization proposal/obligation occurrence foundations.
- Structural seed for Georgia through 2026-04-30 and Florida beginning 2026-05-01; it has no real financial data.
- Workbook rehearsal importer plus a Supabase load command with month/year filtering (full or abbreviated month, two- or four-digit year), latest-24 selection, A:V extraction, immutable source coordinates, import-run lifecycle, and review-required proposals only.
- Atomic historical import database function: raw rows and proposals commit together or roll back together, exact workbook replays return the existing completed run by household + source SHA-256, and execute permission is limited to `service_role`. A generator can produce an owner-readable SQL Editor payload outside the repository when direct secret-key loading is unavailable.
- Deterministic cent-based Safe-to-Spend and daily cash-event projection domain functions.
- Today and Plan retain the normalized-occurrence path and can also render each pending September 2026 review-required proposal independently. Exact raw-row-linked normalized occurrences supersede only their own proposal; repeated labels are not merged, and unparseable amounts/dates remain explicitly unknown.
- Golden unit fixtures cover financial arithmetic, context boundary, sheet selection, provenance, W+ exclusion, no silent alias merging, conservative money/due-date parsing, and atomic import payload guarantees.
- Passwordless email sign-in, verified cookie-session refresh, same-origin callback redirects, authenticated server-side runtime reads, a `household_members` tenant boundary, and RLS policies covering every Checkpoint 0 table, including transitive import/proposal/allocation data.
- Browser sessions are read-only at Checkpoint 0: anonymous grants are revoked and authenticated members receive only `SELECT`; imports use a server-only secret/service-role key.
- Local Next.js development/start scripts are pinned to port 3001, and the application's required passwordless-auth callback is `http://localhost:3001/auth/callback`.
- Live Supabase Auth uses `http://localhost:3001` as the Site URL and has exactly one redirect URL: `http://localhost:3001/auth/callback`; the obsolete port-3000 URL was removed.
- The live atomic import function is deployed. The real workbook was loaded as one imported run with 1,073 raw rows and 729 review-required proposals; an exact replay returned the same import-run identity with `alreadyImported=true`.

## Validation
- `npm test`: 23 tests passing.
- `npx tsc --noEmit`: passing.
- `npm run build`: passing.
- Real-workbook rehearsal selected 24 month/year sheets from May 2024 through September 2026, including abbreviated names such as `Sep 2026` and `June 25`.
- Rehearsal retained 1,073 non-empty A:V source rows and created 729 independent review-required proposals; no identities were merged.
- The durable context boundary is Georgia through April 2026 and Florida beginning May 2026. The corrective live migration preserved all 1,073 raw rows: 837 map to Georgia and 236 map to Florida, including 47 May rows and 39 June rows; validation found zero misclassified rows.
- September 2026 contains 44 retained raw rows and 40 proposals across 38 distinct raw labels. Two repeated labels remain separate proposals, preserving duplicate planning-row evidence.
- The live September rows match the rehearsal: 40 proposal items, 36 deterministically parsed amounts totaling $17,434.00, 4 unknown amounts, 28 known due dates, and 12 unknown due dates.
- Source gaps are preserved rather than synthesized: there are no eligible sheets for December 2024–March 2025 or September 2025.
- Live security verification: all 13 financial tables have RLS enabled and forced; 13 policies are present; anonymous table grants are zero; authenticated write grants are zero; anonymous/authenticated import execution is denied; and only `service_role` can execute the atomic importer.
- Anonymous REST checks return HTTP 401 / PostgreSQL `42501` for both financial-table reads and importer execution.
- The launch Auth user is linked to the household as `OWNER`. Live policy validation returns all 1,073 raw rows and 729 proposals for that owner, while an authenticated non-member receives zero household, membership, raw-row, or proposal records.
- With the live publishable configuration, Next.js starts on `127.0.0.1:3001`; `/`, `/login`, and the no-code callback path return successfully, and the unauthenticated UI requests sign-in without exposing financial data.

## Implemented locally for Checkpoint 1
- Database-driven income recurrence configuration and persisted paycheck occurrence generation.
- Payment policies separating autopay protection from manual optimizer timing.
- First-class budgets, periods, split-ready consumption allocations, and owner-only create/edit/deactivate operation.
- Virtual/physical reserves and obligation-linked reserve movements.
- Account balance snapshots, account-aware event planning, deterministic Safe-to-Spend, and deterministic `PAY`/`RESERVE`/`HOLD` recommendations.
- Minimal database-backed Today, Plan, and Settings/Budgets routes.
- Generic atomic private-configuration loader and SQL generator. No real household configuration is committed.
- Approved worksheet normalized privately into 26 canonical obligations and three budgets after explicit aliases and V2 deferrals; unknown financial inputs remain null.

## Checkpoint 1 validation
- `npm test`: 36 tests passing.
- `npx tsc --noEmit`: passing.
- `npm run build`: passing.
- Local port-3001 smoke test: `/`, `/plan`, `/settings/budgets`, and `/login` return HTTP 200.
- Live deployment and live RLS/UI verification remain pending.

## Next action
Authenticate to the existing Supabase project, apply `20260918000000_checkpoint_1_planning.sql`, load the private normalized configuration, materialize September-November paycheck dates, and run live owner/non-member RLS plus Today/Plan verification. Then configure the still-unknown household inputs before treating live Safe-to-Spend as available.
