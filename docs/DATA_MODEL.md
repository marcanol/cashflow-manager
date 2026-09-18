# Initial Data Model

This is conceptual; migrations may refine naming.

## household
One household root.

## financial_contexts
Represents structural periods such as Georgia home vs Florida home.

Fields:
- id
- household_id
- name
- starts_on
- ends_on
- is_current

## accounts
- id
- household_id
- institution
- name
- type
- purpose
- is_active

## income_sources
- id
- household_id
- person_label
- legacy cadence label
- recurrence type (`INTERVAL_DAYS` or `MONTH_DAYS`)
- interval days and confirmed anchor date, or days-of-month rules
- configurable date-adjustment policy
- destination_account_id
- expected_net_amount
- tolerance
- active

## paycheck_occurrences
- id
- income_source_id
- expected_date
- expected_amount
- actual_date
- actual_amount
- status

## obligations
Canonical bill/debt/one-time identity.

- id
- household_id
- name
- category
- obligation_type
- payment_type
- paid_from_account_id
- active
- portable_across_contexts
- canonical key
- amount behavior (`FIXED`, `VARIABLE`, `UNKNOWN`)
- configuration status (`COMPLETE`, `INCOMPLETE`, `DEFERRED`)

## obligation_aliases
- obligation_id
- alias_type
- alias_value
- source
- effective dates
- optional matching account
- optional broad amount band used only as a secondary discriminator

## obligation_occurrences
Monthly/one-time instance.

- id
- obligation_id
- context_id
- period
- expected_amount
- confirmed_amount
- due_date
- grace_date
- minimum_payment
- status
- source_confidence

## payment_policies
- obligation_id
- allow_planned_late
- late_fee_type
- late_fee_amount
- grace_days
- reporting_risk_date
- shutoff_risk_date
- minimum_liquidity_priority
- payment mode (`AUTOPAY` or `MANUAL`)
- due rule and raw user-confirmed due text
- last-safe rule and raw user-confirmed text
- structured fixed/percentage/minimum/maximum late-fee components
- optimizer enabled flag

## planned_allocations
Maps paycheck/reserve funding to obligations.

- obligation_occurrence_id
- paycheck_occurrence_id
- amount

## reserves
- id
- household_id
- name
- target_amount
- reserve_type
- physical_account_id

## reserve_movements
- reserve_id
- amount
- direction
- related_obligation_occurrence_id
- related_paycheck_occurrence_id
- occurred_on

Reserve movement direction is `FUND` or `RELEASE`. Physical movements may identify from/to accounts; virtual movements protect cash without changing household bank cash.

## budgets
- household-scoped definition
- stable budget key and display name
- active state
- cadence
- configured allocation amount
- optional funding account

## budget_periods
Generated period with start/end dates and allocation amount.

## budget_consumptions
Transaction-to-budget allocations. Separate rows allow a future transaction to be split across multiple existing active budgets. Consumption reduces the owning period's remaining amount.

## account_balance_snapshots
Manual or future bank-feed available/ledger balances and pending transaction totals by account and timestamp.

## household_financial_settings
Household-level deterministic planning settings, beginning with the safety buffer.

## bank_transactions
Plaid-derived actual activity.

## reconciliation_matches
Maps bank transactions to obligation occurrences, income, budgets, or transfers.

## merchant_rules
Persistent user-approved matching rules.

## statement_documents
Email/manual statement source.

## statement_matches
Maps statement to obligation occurrence.

## exceptions
Items requiring human review.

## forecast_events
Normalized cash-flow events used by deterministic forecast.

## optimizer_runs
Stores inputs, selected plan, rejected alternatives, costs, and projected low balances.

## recommendations
Human-readable actions derived from deterministic optimizer output.
