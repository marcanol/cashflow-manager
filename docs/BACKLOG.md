# Backlog

## COMPLETE — Checkpoint 0
- [x] Scaffold Next.js application
- [x] Initialize Supabase structure (migration + non-sensitive structural seed)
- [x] Create core migrations
- [x] Create historical context records (Georgia through April 2026; Florida from May 2026)
- [x] Create raw spreadsheet import tables
- [x] Implement month/year sheet selector
- [x] Enforce W+ exclusion
- [x] Import latest ~24 months — live load contains 1,073 raw rows and 729 review-required proposals; exact replay is idempotent
- [x] Create cautious normalization/proposal pass
- [x] Load September 2026 as validation month — live database matches the 44-row / 40-proposal rehearsal
- [x] Build minimal Today screen
- [x] Build minimal Plan screen
- [x] Render pending historical proposals without promoting or merging identities
- [x] Make historical import atomic and replay-safe by household + workbook SHA-256
- [x] Create golden financial test fixtures
- [x] Validate spreadsheet vs app — live September database values match the deterministic Today/Plan expectations
- [x] Add passwordless authentication and household-scoped RLS
- [x] Configure Supabase Auth redirect URLs and bootstrap first household member as `OWNER`

## NOW — Checkpoint 1
- [x] Correct income account destinations and persist recurrence configuration
- [x] Generate deterministic Luis and Anamary paycheck dates
- [x] Normalize the approved Florida worksheet into a private, ignored configuration artifact
- [x] Build canonical obligation, alias, amount-behavior, and payment-policy foundation
- [x] Build first-class budgets, periods, and split-ready consumption model
- [x] Model virtual and physical reserve movements
- [x] Implement account-aware deterministic Safe-to-Spend without reserve double-counting
- [x] Implement first-pass `PAY`, `RESERVE`, and `HOLD` recommendations
- [x] Add minimal Today, Plan, and Settings/Budgets flows
- [x] Add forced RLS and owner-only budget write operation
- [x] Apply Checkpoint 1 migration to live Supabase
- [ ] Load private household configuration and materialize live paychecks
- [ ] Verify live owner/non-member RLS and database-backed Today/Plan output
- [ ] Configure current PNC/Chase balances, safety buffer, expected net paycheck amounts, and missing budget allocations

## NEXT
- [ ] Plaid integration
- [ ] Bank reconciliation
- [ ] Gmail statements
- [ ] Rollover wizard

## LATER
- [ ] V3 analytics
- [ ] GPT natural-language interface
- [ ] reserve-fund optimization
- [ ] Figma / Claude Design UI replacement
- [ ] Debt-account subsystem for Anthony Loan, Mom, and Mom Home Depot, including recurring payments and remaining principal/balance
- [ ] Resolve Anamary's February/invalid-30th payroll adjustment policy before that calendar edge is forecast
