# Reconciliation

## Two reconciliation paths

### Bank reconciliation
Question: what did this bank transaction represent?

### Statement reconciliation
Question: which known obligation does this new statement belong to?

## Confidence policy
- user-approved persistent rule: auto-match
- deterministic known merchant/history: auto-match with log
- medium confidence: suggest
- low confidence: Needs Review

## Learning
AI proposes fuzzy mappings.
Persisted rule engine remembers approved mappings.

## Unknown transaction actions
- match existing obligation
- create new obligation
- categorize spending
- internal transfer
- ignore
- flag

## Pending/posted
Ingestion must be idempotent and support transaction evolution from pending to posted.
