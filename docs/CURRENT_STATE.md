# Current State

## Status
Checkpoint 0 is complete. The live Supabase project has the full schema/RLS baseline, atomic import migration, corrected May 2026 Florida boundary, and the real historical workbook load. The source workbook, rehearsal artifact, and generated SQL payload remain outside Git. The live database matches the real-workbook rehearsal and the exact workbook replay returned the existing run without duplicating data. Passwordless authentication is configured for port 3001; the launch owner exists in Supabase Auth, has an `OWNER` household membership, and the authenticated owner/non-member RLS paths have been validated live.

## Locked inputs
- `bills.xlsx` is the historical source.
- Only month/year tabs are relevant.
- Ignore W onward.
- Active history target is approximately 24 months.
- Florida/current-home context begins May 2026.
- Net deposited income only.
- Luis: biweekly Friday → Chase.
- Wife: 15th and 30th → PNC.
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

## Next checkpoint
Begin the payment optimizer and reserve-movement model on top of the validated historical model. A normal end-user magic-link smoke test should be repeated when a deployable application URL replaces the local-only callback; this does not block the completed Checkpoint 0 data, security, or deterministic-rendering foundation.
