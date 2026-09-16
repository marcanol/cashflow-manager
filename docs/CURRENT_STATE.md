# Current State

## Status
Checkpoint 0 foundation implementation is in place and locally validated. The only incomplete validation is the real historical import because `bills.xlsx` is deliberately not present in this repository/workspace.

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
- Workbook rehearsal importer plus a Supabase load command with strict month/year filtering, latest-24 selection, A:V extraction, immutable source coordinates, import-run lifecycle, and review-required proposals only.
- Deterministic cent-based Safe-to-Spend and daily cash-event projection domain functions.
- Golden unit fixtures cover financial arithmetic, context boundary, sheet selection, provenance, W+ exclusion, and no silent alias merging.

## Validation
- `npm test`: 8 tests passing.
- `npm run build`: passing.

## Remaining gate
`bills.xlsx` must be supplied at an external local path (never committed). Rehearse with `npm run import:workbook -- /absolute/path/to/bills.xlsx /tmp/cashflow-import-rehearsal.json`; load with `SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run import:supabase -- /absolute/path/to/bills.xlsx`; then verify the real September 2026 representation. The source workbook and Supabase project credentials/configuration are absent from this clone.
