# Human Decision Gates

Agents should NOT stop for:
- routine code changes
- schema additions that implement already-approved requirements
- tests
- lint/type fixes
- refactors
- documentation maintenance
- non-destructive seed/import rehearsals
- obvious UI wiring

Agents MUST stop for:
- destructive production data changes
- credential/authorization action
- unresolved identity merge that may corrupt financial history
- a choice that materially changes financial math
- new payment policy not already defined
- a source contradiction that changes amounts/dates/identity
- security design with meaningful tradeoffs

When stopping, present:
1. exact decision,
2. why it matters,
3. 2–3 concrete options,
4. recommended default if safe,
5. work that can continue independently.
