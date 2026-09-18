# Checkpoint 1 — Paycheck Planning, Budgets, Reserves, and Safe-to-Spend

## Objective
Build the deterministic forward-planning model on top of the validated Checkpoint 0 history without introducing bank feeds, Gmail, or AI-controlled financial math.

## Definition of Done
- [x] Checkpoint 0 tests remain green.
- [x] Income destinations are corrected: Luis to PNC and Anamary to Chase.
- [x] Luis's 14-day schedule is anchored to 2026-09-25 and generates 2026-09-25, 2026-10-09, 2026-10-23, and 2026-11-06.
- [x] Anamary's database configuration generates 2026-09-15, 2026-09-30, 2026-10-15, and 2026-10-30.
- [x] Invalid-30th behavior remains an explicit unresolved configuration rather than an invented February rule.
- [x] The approved Florida worksheet normalizes into private configuration without fuzzy identity merging or amount-based identity.
- [x] Explicit historical renames become aliases rather than duplicate current obligations.
- [x] Variable obligations preserve one identity when amounts change.
- [x] Autopay obligations are forecast/protected and excluded from payment timing and modeled late fees.
- [x] Manual obligations participate in deterministic `PAY`, `RESERVE`, and `HOLD` recommendations.
- [x] Pool is a budget, not an obligation.
- [x] Home Food, Spending Allowance, and Pool are database-backed budget definitions.
- [x] Budget definitions can be created, edited, and deactivated without code changes.
- [x] Allocation validation rejects missing/inactive budgets and the schema supports future split allocations.
- [x] Budget consumption reduces period remaining amount.
- [x] Virtual and physical reserve movements are modeled.
- [x] Reserved obligations affect Safe-to-Spend exactly once and disappear after reconciliation/release.
- [x] Account-aware PNC/Chase events and household planning are supported.
- [x] Today, Plan, and Settings/Budgets consume database-backed planning data.
- [x] All new financial tables have forced RLS; budget writes are constrained to an owner-checked operation.
- [ ] Live migration, private configuration load, and live owner/non-member RLS verification complete.
- [ ] Live Today/Plan verification complete with the loaded Checkpoint 1 configuration.

## Local validation evidence
- `npm test`: 36 tests passing.
- `npx tsc --noEmit`: passing.
- `npm run build`: passing.
- Development startup on `127.0.0.1:3001`: `/`, `/plan`, `/settings/budgets`, and `/login` return HTTP 200.
- Private worksheet normalization: 61 reviewed source rows, 30 in-scope Florida rows after V2 deferrals, 26 canonical obligations, three budgets, and two deferred debt items. The private JSON remains outside Git.

## Known unconfigured household inputs
- Current PNC and Chase available balances.
- Household safety buffer.
- Expected net paycheck amounts and tolerances.
- Home Food and Spending Allowance allocation amounts.
- Statement-confirmed forecasts for variable obligations.

Unknown inputs remain unknown. They are not converted to zero and prevent the live Safe-to-Spend total from presenting false precision.

## Explicitly excluded
- Plaid and bank-feed ingestion
- Gmail statement ingestion
- Full reconciliation workflow
- Full debt-account and remaining-principal tracking
- AI-controlled calculations or recommendations
