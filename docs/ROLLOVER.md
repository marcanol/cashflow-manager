# Monthly Rollover

## Goal
Prepare the next month with as little manual work as possible.

## Default timing
A configurable preparation window, conceptually ~5 days before month end.

## Process
1. Generate next-month obligation occurrences.
2. Populate deterministic fixed recurring values.
3. Search connected email for known statements.
4. Parse amount and due date.
5. Reconcile statement to known obligation.
6. Mark confirmed values.
7. Estimate unresolved variable bills using relevant context.
8. Create a short Needs Information queue.
9. User completes missing values via one-at-a-time wizard or bulk paste.
10. Recalculate next-month cash-flow plan.

## Source status
Each upcoming obligation should expose:
- CONFIRMED_STATEMENT
- CONFIRMED_USER
- CONFIRMED_FIXED
- ESTIMATED_HISTORY
- UNKNOWN

Never silently present an estimate as confirmed.
