# Durable Product Decisions

## Product/UI
- Prefer Xero-like simplicity over QuickBooks/Great Plains complexity.
- Initial design is intentionally functional/minimal.
- UI is replaceable later by Figma/Claude Design.
- Core navigation target: Today, Plan, Transactions, Bills, Settings.
- No financial logic in presentation components.

## Human-in-the-loop
- Minimize user involvement for non-decision work.
- Agents continue automatically through safe implementation and validation.
- User is pulled in only for material decisions, destructive actions, auth/security, or meaningful ambiguity.

## Security and tenancy
- Supabase Auth uses passwordless email links. Authentication alone does not grant access to household financial data.
- `household_members` is the tenancy boundary; an authenticated user may access a row only when they belong to the owning household.
- Launch begins with one approved `OWNER`. The authorization model remains membership-based and must support adding further `OWNER` or `MEMBER` users after go-live; application and database logic must not assume a permanently single-user household.
- The initial live household has one enrolled `OWNER`; additional users are added later by creating an Auth identity and a separate `household_members` row, without schema or policy changes.
- Every Checkpoint 0 table has RLS enabled and forced. Tables without a direct household foreign key authorize through their owning parent chain.
- Browser and runtime server clients use only the Supabase publishable/anonymous key and authenticated session. Secret/service-role credentials are server-only and used solely by the explicit import script.
- Checkpoint 0 application sessions are read-only: `anon` and `authenticated` grants are revoked, then only `SELECT` is granted back to authenticated users. Later write workflows require explicit per-operation grants and policies.
- Next.js Proxy refreshes and verifies cookie-backed sessions. Authentication callbacks accept only same-origin relative redirect paths.

## Historical data
- Active historical import window: approximately the most recent 24 months only.
- Spreadsheet month/year tabs are the historical source.
- Ignore columns W and later.
- Ignore templates, Info, Money, and other non-month/year tabs.
- Month/year recognition accepts full or abbreviated English month names and two- or four-digit years because the source uses all of these forms (for example, `September 2026`, `Sep 2026`, and `June 25`).
- Preserve source rows/provenance even when normalized.
- Omit fully empty formatted rows, but preserve each retained row's original worksheet row number and A:V source range.
- Do not silently merge fuzzy aliases.
- Checkpoint 0 imports are rehearsable without a database: the importer produces raw rows and review-required normalization proposals. With a configured Supabase service role it persists a tracked import run, raw provenance, and proposals; source files and credentials remain outside Git.
- Historical persistence is one database transaction. A completed workbook import is idempotent by household plus exact source SHA-256; a repeated identical payload returns the existing run, while an error rolls back its run, raw rows, and proposals together.
- Generated SQL import payloads contain private financial data, must be written outside the repository, and are ignored by the repository's `*.import.sql` guard. The committed generator and migration contain no real financial source data.
- Pending historical normalization proposals may appear in Checkpoint 0 Today/Plan as explicitly review-required source evidence. They remain independent, never create canonical obligations, and are suppressed only when a normalized occurrence links to that exact raw row.
- Spreadsheet money and due-date text is parsed by conservative deterministic functions. Unsupported, malformed, negative obligation, or ambiguous values remain unknown rather than becoming zero or an inferred date.

## Implementation
- Monetary domain values are represented as integer cents. Deterministic domain functions, not UI or AI, calculate financial values.
- The initial UI uses a replaceable repository adapter. It deliberately shows unknown rather than zero until a configured database provides imported history and bank-balance inputs; it does not invent financial amounts.
- Cashflow Manager reserves `localhost:3001` for both local Next.js development and local production-mode verification because Attendly owns `localhost:3000`. The corresponding local Supabase Auth callback is `http://localhost:3001/auth/callback`.

## Context break
- Current Florida-home financial context begins May 2026, reflecting the actual household move month.
- Older Georgia home costs are not apple-to-apple for current home-cost forecasting.
- Current-context observations should dominate forecasting for mortgage/utilities/property-related costs.
- Older history may still be useful for portable obligations and behavioral analysis.

## Income
- Only post-tax / deposited cash is modeled.
- Luis: paid every 2 weeks on Friday into Chase.
- Wife: paid on the 15th and 30th into PNC.
- Income schedule is predictable; bank deposits confirm actual amount.
- Internal Chase/PNC transfers are not income.

## Planning and reserves
- A bill may be funded by more than one paycheck.
- Reserved money is excluded from Safe-to-Spend before the bill posts.
- Reserve may be physical (actual transfer to savings) or virtual.
- System may recommend moving money into savings to protect it for a later payment.
- Planned lateness is a valid optimizer outcome when allowed by policy.
- Planned late fees must be explicit and included in optimization.
- Track planned and unplanned late fees separately.
- Track monthly total late fees.

## Reconciliation
- Rules remember; AI suggests.
- Initial bank reconciliation should support a large confirmation pass.
- User-approved merchant/bill matches become persistent rules.
- Unknown transactions become exceptions / To Do items.
- Pending-to-posted changes must be handled idempotently.

## Monthly rollover
- Rollover is not a blind copy of prior month.
- Generate next-month obligations, auto-fill deterministic values, ingest statement-confirmed values, estimate unresolved values, then ask only for missing information.
- Preparation window is configurable; default concept is ~5 days before month end.
- Gmail statement ingestion is preferred over fragile portal scraping.

## V3
- Analytics + AI evaluates reserve sizing, late-fee reduction, historical what-if simulations, cash-pressure drivers, and natural-language questions.
- Deterministic analytics computes numbers; GPT explains and explores scenarios.
