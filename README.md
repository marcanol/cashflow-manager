# Household Cashflow App

A minimal, Xero-inspired household cash-flow control system focused on:
- forward-looking cash availability
- paycheck-aware bill planning
- reserve management
- payment timing optimization
- bank reconciliation
- statement ingestion
- eventual analytics + AI

The application is intentionally not a general-purpose accounting package.

## Development principle

Financial correctness > UI completeness.

The UI must remain replaceable. Financial calculations belong in deterministic domain services and must be testable independently of the presentation layer.

## Source of truth

Read these first in every development session:

1. `AGENTS.md`
2. `docs/PRODUCT.md`
3. `docs/DECISIONS.md`
4. `docs/FINANCIAL_RULES.md`
5. `docs/CURRENT_STATE.md`
6. `docs/BACKLOG.md`

## Current checkpoint

Checkpoint 0 — Foundation & Historical Model.

See `docs/checkpoints/CHECKPOINT_0.md`.

## Local development

```bash
npm install
npm run dev
npm test
```

Cashflow Manager always runs locally at `http://localhost:3001` so it can run alongside Attendly on port 3000. Supabase Auth must allow `http://localhost:3001/auth/callback` for passwordless sign-in.

The Supabase migration is in `supabase/migrations/`; `supabase/seed.sql` creates only a synthetic structural household and the Georgia/Florida context boundary. It contains no personal data.

Copy `.env.example` to `.env.local` and populate it from the Supabase project Connect dialog. Never commit `.env.local` or any secret/service-role key. Browser code uses only the publishable key; the secret key is reserved for the explicit import command.

To rehearse a real workbook import without placing it in Git:

```bash
npm run import:workbook -- /absolute/path/to/bills.xlsx /tmp/cashflow-import-rehearsal.json
```

The importer selects only month/year sheets, keeps the latest 24, reads A:V only, and writes raw provenance plus review-required normalization proposals. The JSON output is a rehearsal artifact; do not commit it.

After the migrations have been applied, a configured secret key can load the same payload through one atomic, source-SHA-idempotent database function:

```bash
SUPABASE_URL=... SUPABASE_SECRET_KEY=... HOUSEHOLD_ID=... npm run import:supabase -- /absolute/path/to/bills.xlsx
```

If direct database credentials are not available, generate a SQL Editor payload outside the repository. The output contains private financial data, is created with owner-only permissions, and must be deleted after use:

```bash
HOUSEHOLD_ID=... npm run import:sql -- /absolute/path/to/bills.xlsx /tmp/bills.import.sql
```

Running either payload again for the same household and exact workbook SHA-256 returns the existing completed import rather than duplicating rows. Any error rolls the entire import back; proposals remain independent and `REVIEW_REQUIRED`.
