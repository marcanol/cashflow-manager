# Current State

## Status
Checkpoint 0 foundation implementation is in place and locally validated. A non-destructive rehearsal has been completed against the real `bills.xlsx` retrieved from the user's Google Drive; the source workbook and rehearsal artifact remain outside Git. The selected passwordless-email, household-membership, and RLS security model is implemented. The repository now also has an atomic, source-SHA-idempotent import path and a database-backed September review view; live application of the newest migration, data loading, and allow/deny verification remain operational steps.

## Locked inputs
- `bills.xlsx` is the historical source.
- Only month/year tabs are relevant.
- Ignore W onward.
- Active history target is approximately 24 months.
- Florida/current-home context begins July 2026.
- Net deposited income only.
- Luis: biweekly Friday → Chase.
- Wife: 15th and 30th → PNC.
- Product should minimize human-in-the-loop work.
- Initial UI should be Xero-simple and replaceable.
- Local Cashflow Manager development and production-mode verification use `http://localhost:3001`; Attendly retains port 3000.

## Implemented in Checkpoint 0
- Next.js app with minimal Today and Plan routes backed by a Supabase repository. When its environment variables are absent, it displays an explicit unavailable state rather than invented money.
- Supabase migration for household/context/account/income/import provenance/normalization proposal/obligation occurrence foundations.
- Structural seed for Georgia through 2026-06-30 and Florida beginning 2026-07-01; it has no real financial data.
- Workbook rehearsal importer plus a Supabase load command with month/year filtering (full or abbreviated month, two- or four-digit year), latest-24 selection, A:V extraction, immutable source coordinates, import-run lifecycle, and review-required proposals only.
- Atomic historical import database function: raw rows and proposals commit together or roll back together, exact workbook replays return the existing completed run by household + source SHA-256, and execute permission is limited to `service_role`. A generator can produce an owner-readable SQL Editor payload outside the repository when direct secret-key loading is unavailable.
- Deterministic cent-based Safe-to-Spend and daily cash-event projection domain functions.
- Today and Plan retain the normalized-occurrence path and can also render each pending September 2026 review-required proposal independently. Exact raw-row-linked normalized occurrences supersede only their own proposal; repeated labels are not merged, and unparseable amounts/dates remain explicitly unknown.
- Golden unit fixtures cover financial arithmetic, context boundary, sheet selection, provenance, W+ exclusion, no silent alias merging, conservative money/due-date parsing, and atomic import payload guarantees.
- Passwordless email sign-in, verified cookie-session refresh, same-origin callback redirects, authenticated server-side runtime reads, a `household_members` tenant boundary, and RLS policies covering every Checkpoint 0 table, including transitive import/proposal/allocation data.
- Browser sessions are read-only at Checkpoint 0: anonymous grants are revoked and authenticated members receive only `SELECT`; imports use a server-only secret/service-role key.
- Local Next.js development/start scripts are pinned to port 3001, and the local passwordless-auth callback is `http://localhost:3001/auth/callback`.

## Validation
- `npm test`: 22 tests passing.
- `npx tsc --noEmit`: passing.
- `npm run build`: passing.
- Real-workbook rehearsal selected 24 month/year sheets from May 2024 through September 2026, including abbreviated names such as `Sep 2026` and `June 25`.
- Rehearsal retained 1,073 non-empty A:V source rows and created 729 independent review-required proposals; no identities were merged.
- 923 raw rows map to the prior Georgia context and 150 map to the Florida context (July 2026 onward).
- September 2026 contains 44 retained raw rows and 40 proposals across 38 distinct raw labels. Two repeated labels remain separate proposals, preserving duplicate planning-row evidence.
- Source gaps are preserved rather than synthesized: there are no eligible sheets for December 2024–March 2025 or September 2025.

## Remaining live work
Apply `20260917120000_atomic_historical_import.sql` to the live project, load the external workbook through either the atomic service-role command or generated external SQL payload, and verify the September 2026 database/UI representation plus live allow/deny RLS behavior. The generated payload contains private financial data and must remain outside Git. The browser uses only the publishable/anonymous key; administrative credentials remain server-only.
