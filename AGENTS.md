# Agent Operating Instructions

## Mission
Build a household cash-flow control system that minimizes manual work while preserving explicit user control over material financial decisions.

## Working style
Continue automatically through non-destructive, non-ambiguous work. Do not stop merely because a subtask is complete.

Stop only for:
1. a material business/product decision,
2. destructive or irreversible action,
3. authorization/security boundary,
4. unexplained source contradiction,
5. ambiguity that materially changes financial behavior.

Routine schema work, CRUD, tests, refactoring, documentation updates, validation, bug fixes, and non-material implementation choices should proceed without waiting for the user.

## Required completion behavior
After every coherent work package:
- run relevant tests,
- fix failures that do not require a product decision,
- update `docs/CURRENT_STATE.md`,
- update `docs/BACKLOG.md`,
- update `docs/DECISIONS.md` only for durable decisions,
- state any unresolved decision gate explicitly.

Do not create separate handoff files unless specifically required. The repository is the handoff.

## Financial safety rules
- Never use AI-generated arithmetic as authoritative financial logic.
- All balances, forecasts, reserves, late fees, payoff timing, and Safe-to-Spend calculations must be deterministic and testable.
- AI may classify, suggest matches, summarize, explain, and answer natural-language questions over computed data.
- Do not silently merge historical bill identities on fuzzy name similarity.
- Preserve provenance from imported source rows.
- Treat internal bank transfers as transfers, not income or spending.
- All income values are NET / post-tax deposited cash only. Gross income does not exist in this model.

## UI rules
- Initial UI should favor Xero-like simplicity.
- Minimal navigation, low visual density, plain language.
- No business logic in UI components.
- UI must be replaceable later by Figma/Claude Design without rewriting domain services.
