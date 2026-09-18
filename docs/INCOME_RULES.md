# Income Rules

## Luis
- cadence: exactly every 14 days
- weekday: Friday
- confirmed schedule anchor: 2026-09-25
- destination: PNC
- amount: expected NET deposited amount
- generation: forward from a known confirmed payday
- actual confirmation: bank transaction

## Anamary
- cadence: semi-monthly
- days: 15th and 30th
- destination: Chase
- amount: expected NET deposited amount
- actual confirmation: bank transaction
- invalid-30th policy: configurable and currently unresolved; do not silently substitute a February date

## General
Gross salary and payroll deductions are intentionally excluded.

If actual deposit differs from expected by tolerance:
- post actual cash,
- raise review item,
- recalculate forecast.

Paycheck occurrences are cash-flow events, not merely monthly income totals.

Schedule fields, destination accounts, expected net amounts, tolerances, active state, and date-adjustment policy are persisted. UI and domain functions consume this configuration rather than hardcoding household schedules.
