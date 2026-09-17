# Backlog

## NOW — Checkpoint 0
- [x] Scaffold Next.js application
- [x] Initialize Supabase structure (migration + non-sensitive structural seed)
- [x] Create core migrations
- [x] Create historical context records (Georgia through June 2026; Florida from July 2026)
- [x] Create raw spreadsheet import tables
- [x] Implement month/year sheet selector
- [x] Enforce W+ exclusion
- [ ] Import latest ~24 months — real-workbook rehearsal passed; atomic/idempotent persistence path is complete, live load remains
- [x] Create cautious normalization/proposal pass
- [ ] Load September 2026 as validation month — rehearsal and proposal-backed UI read path passed; live load remains
- [x] Build minimal Today screen
- [x] Build minimal Plan screen
- [x] Render pending historical proposals without promoting or merging identities
- [x] Make historical import atomic and replay-safe by household + workbook SHA-256
- [x] Create golden financial test fixtures
- [ ] Validate spreadsheet vs app — importer and deterministic proposal rendering are validated; live database/UI comparison remains
- [x] Add passwordless authentication and household-scoped RLS
- [ ] Configure Supabase Auth redirect URLs and bootstrap first household member — local port-3001 callback configured; first member bootstrap remains

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
