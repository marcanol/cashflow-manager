# Financial Rules

## Safe-to-Spend

Conceptual formula:

Safe-to-Spend =
available bank cash
- pending bank transactions
- reserved obligations
- remaining protected spending allocations
- required bills before relevant incoming cash
- configured safety buffer

The production formula may use account-specific and household-level projections, but must never double-count reserved obligations.

## Bank balances
Keep separate:
- ledger balance
- bank available balance
- pending transactions
- reserved obligations
- protected budget allocations
- projected available balance
- Safe-to-Spend

## Income
Only net deposited cash is used.

Expected income is generated from schedule.
Actual income is confirmed from posted bank deposits.
Unexpected variance creates an exception.

## Account awareness
Household cash may be sufficient while the payment account is not.
Forecast both household and account-level liquidity.

## Transfers
A transfer between household-owned accounts:
- reduces one account,
- increases another,
- does not affect household income,
- does not count as spending.

Pair both sides when possible.

## Reserves
A reserve is committed cash for a future obligation.

Reserve types:
- physical reserve: actual funds moved to another account,
- virtual reserve: funds remain in account but are excluded from Safe-to-Spend.

A single obligation may be funded from multiple paychecks.

## Payment status
At minimum:
- ON_TIME
- PLANNED_LATE
- UNPLANNED_LATE
- AT_RISK
- PAST_OPTIMAL_DATE

## Optimizer goals
Subject to user policy:
1. avoid overdraft,
2. protect minimum liquidity buffer,
3. avoid material delinquency / credit reporting risk,
4. avoid service shutoff,
5. respect minimum payments,
6. minimize total penalties,
7. preserve liquidity until future income when economically useful.

Intentional lateness is allowed only when policy permits it.
Late fees are part of objective cost.

## Monthly late-fee analytics
Track:
- planned late fees,
- unplanned late fees,
- total incurred late fees,
- fees avoided by reserve use,
- liquidity preserved by delayed payment.

## Forecast
Simulate daily cash events through the selected horizon and identify projected low points before they occur.
