# Backlog

## NOW — Checkpoint 0
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

## NEXT
- [ ] Payment optimizer
- [ ] Reserve movement model
- [ ] Safe-to-Spend engine
- [ ] Plaid integration
- [ ] Bank reconciliation
- [ ] Gmail statements
- [ ] Rollover wizard

## LATER
- [ ] V3 analytics
- [ ] GPT natural-language interface
- [ ] reserve-fund optimization
- [ ] Figma / Claude Design UI replacement
