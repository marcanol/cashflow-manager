# Current State

## Status
Checkpoint 0 foundation implementation is in place and locally validated. A non-destructive rehearsal has been completed against the real `bills.xlsx` retrieved from the user's Google Drive; the source workbook and rehearsal artifact remain outside Git. The selected passwordless-email, household-membership, and RLS security model is implemented in migration and application code; live project configuration and data loading remain pending.

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

## Implemented in Checkpoint 0
- Next.js app with minimal Today and Plan routes backed by a Supabase repository. When its environment variables are absent, it displays an explicit unavailable state rather than invented money.
- Supabase migration for household/context/account/income/import provenance/normalization proposal/obligation occurrence foundations.
- Structural seed for Georgia through 2026-06-30 and Florida beginning 2026-07-01; it has no real financial data.
- Workbook rehearsal importer plus a Supabase load command with month/year filtering (full or abbreviated month, two- or four-digit year), latest-24 selection, A:V extraction, immutable source coordinates, import-run lifecycle, and review-required proposals only.
- Deterministic cent-based Safe-to-Spend and daily cash-event projection domain functions.
- Golden unit fixtures cover financial arithmetic, context boundary, sheet selection, provenance, W+ exclusion, and no silent alias merging.
- Passwordless email sign-in, verified cookie-session refresh, same-origin callback redirects, authenticated server-side runtime reads, a `household_members` tenant boundary, and RLS policies covering every Checkpoint 0 table, including transitive import/proposal/allocation data.
- Browser sessions are read-only at Checkpoint 0: anonymous grants are revoked and authenticated members receive only `SELECT`; imports use a server-only secret/service-role key.

## Validation
- `npm test`: 15 tests passing.
- `npm run build`: passing.
- Real-workbook rehearsal selected 24 month/year sheets from May 2024 through September 2026, including abbreviated names such as `Sep 2026` and `June 25`.
- Rehearsal retained 1,073 non-empty A:V source rows and created 729 independent review-required proposals; no identities were merged.
- 923 raw rows map to the prior Georgia context and 150 map to the Florida context (July 2026 onward).
- September 2026 contains 44 retained raw rows and 40 proposals across 38 distinct raw labels. Two repeated labels remain separate proposals, preserving duplicate planning-row evidence.
- Source gaps are preserved rather than synthesized: there are no eligible sheets for December 2024–March 2025 or September 2025.

## Remaining gate
No live Supabase project was created or configured. After a project exists, configure email magic-link auth and the allowed redirect URL, apply migrations, run live allow/deny RLS tests, create the initial `household_members` record through a controlled server/secret-key setup, load the rehearsed workbook, and verify the September 2026 database/UI representation. The browser uses only the publishable/anonymous key; administrative credentials remain server-only for the import script.
