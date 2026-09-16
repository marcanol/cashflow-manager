# Current State

## Status
Repository foundation specification created.

No production application code exists yet.

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

## Next
Checkpoint 0:
1. scaffold app,
2. define Supabase schema,
3. build raw spreadsheet importer,
4. build normalization proposal layer,
5. load latest relevant month history,
6. render initial September 2026 representation,
7. create golden financial tests.
