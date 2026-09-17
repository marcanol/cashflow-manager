# Checkpoint 0 — Foundation & Historical Model

## Objective
Prove the application can understand the user's existing planning model before adding Plaid, Gmail, or AI.

## Definition of Done
1. Next.js app runs locally.
2. Supabase schema exists for raw imports + core normalized entities.
3. Importer reads `bills.xlsx`.
4. Only month/year tabs from approximately the latest 24 months are considered.
5. Columns W+ are ignored.
6. Non-month tabs are excluded.
7. May 2026 onward is tagged current Florida-home context.
8. Raw provenance is preserved.
9. Normalization does not silently merge uncertain identities.
10. September 2026 is represented in the database.
11. Minimal Today and Plan screens render deterministic numbers from the database.
12. Golden financial fixtures exist.
13. Tests pass.
14. `CURRENT_STATE.md` and `BACKLOG.md` are updated.

## Explicitly not part of Checkpoint 0
- Plaid
- Gmail
- production notifications
- GPT
- polished UI
- bill-portal automation
