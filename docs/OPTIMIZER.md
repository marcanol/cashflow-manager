# Payment Optimizer

## Purpose
Recommend:
- what to pay,
- when to pay it,
- which paycheck funds it,
- whether money should be reserved,
- when funds should move between accounts,
- whether planned lateness is economically justified.

## Obligation dates
A manual obligation may have:
- due date
- earliest useful pay date
- recommended pay date
- latest safe pay date
- actual pay date

## Example
Mortgage = $6,400.
$1,500 from paycheck 1 must be protected.
Optimizer may recommend moving $1,500 to savings.
Paycheck 2 arrives on the 28th.
Move reserve back, combine with paycheck 2, and pay mortgage.

If policy allows planned lateness:
- show $200 late fee,
- classify as PLANNED_LATE,
- include it in monthly fee totals,
- explain liquidity preserved and projected low-balance tradeoff.

## AI boundary
Optimizer output is deterministic.
AI may explain why the chosen plan dominates alternatives.
