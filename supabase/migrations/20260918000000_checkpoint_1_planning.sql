-- Checkpoint 1 deterministic paycheck planning, budgets, reserves, and Safe-to-Spend foundation.
-- This migration is generic and contains no household-specific amounts, aliases, or configuration.

alter table accounts add column if not exists account_key text;
alter table accounts add constraint accounts_household_account_key_unique unique (household_id, account_key);

alter table income_sources add column if not exists recurrence_type text
  check (recurrence_type in ('INTERVAL_DAYS', 'MONTH_DAYS'));
alter table income_sources add column if not exists interval_days integer check (interval_days > 0);
alter table income_sources add column if not exists anchor_date date;
alter table income_sources add column if not exists days_of_month smallint[];
alter table income_sources add column if not exists date_adjustment_policy text
  check (date_adjustment_policy in ('LAST_DAY_OF_MONTH', 'PREVIOUS_WEEKDAY', 'NEXT_WEEKDAY'));
alter table income_sources add constraint income_sources_recurrence_shape check (
  recurrence_type is null
  or (recurrence_type = 'INTERVAL_DAYS' and interval_days is not null and anchor_date is not null and days_of_month is null)
  or (recurrence_type = 'MONTH_DAYS' and interval_days is null and anchor_date is null and cardinality(days_of_month) > 0)
);
alter table income_sources add constraint income_sources_household_person_unique unique (household_id, person_label);
alter table paycheck_occurrences alter column expected_amount_cents drop not null;

alter table obligations add column if not exists canonical_key text;
alter table obligations add column if not exists amount_behavior text not null default 'FIXED'
  check (amount_behavior in ('FIXED', 'VARIABLE', 'UNKNOWN'));
alter table obligations add column if not exists configuration_status text not null default 'COMPLETE'
  check (configuration_status in ('COMPLETE', 'INCOMPLETE', 'DEFERRED'));
alter table obligations add constraint obligations_household_canonical_key_unique unique (household_id, canonical_key);

alter table obligation_aliases add column if not exists effective_from date;
alter table obligation_aliases add column if not exists effective_to date;
alter table obligation_aliases add column if not exists match_account_id uuid references accounts(id);
alter table obligation_aliases add column if not exists amount_min_cents bigint check (amount_min_cents >= 0);
alter table obligation_aliases add column if not exists amount_max_cents bigint check (amount_max_cents >= 0);
alter table obligation_aliases add constraint obligation_alias_amount_band check (
  amount_min_cents is null or amount_max_cents is null or amount_min_cents <= amount_max_cents
);

alter table obligation_occurrences add column if not exists last_safe_date date;
create unique index if not exists obligation_occurrences_obligation_period_unique
  on obligation_occurrences(obligation_id, period) where raw_import_row_id is null;

create table household_financial_settings (
  household_id uuid primary key references households(id) on delete cascade,
  safety_buffer_cents bigint check (safety_buffer_cents >= 0),
  updated_at timestamptz not null default now()
);

create table payment_policies (
  obligation_id uuid primary key references obligations(id) on delete cascade,
  payment_mode text not null check (payment_mode in ('AUTOPAY', 'MANUAL')),
  due_rule text not null default 'UNKNOWN' check (due_rule in ('DAY_OF_MONTH', 'MONTH_END', 'NO_FIXED_DATE', 'UNKNOWN')),
  due_day smallint check (due_day between 1 and 31),
  due_is_approximate boolean not null default false,
  due_rule_text text,
  last_safe_rule text not null default 'UNKNOWN' check (last_safe_rule in ('DAY_OF_MONTH', 'DAYS_AFTER_DUE', 'MONTH_END', 'NONE', 'UNKNOWN')),
  last_safe_day smallint check (last_safe_day between 1 and 31),
  last_safe_offset_days smallint check (last_safe_offset_days >= 0),
  last_safe_rule_text text,
  allow_planned_late boolean not null default false,
  late_fee_type text not null default 'NONE' check (late_fee_type in ('NONE', 'FIXED', 'PERCENT', 'GREATER_OF_FIXED_OR_PERCENT')),
  late_fee_fixed_cents bigint check (late_fee_fixed_cents >= 0),
  late_fee_rate numeric(9,6) check (late_fee_rate >= 0),
  late_fee_min_cents bigint check (late_fee_min_cents >= 0),
  late_fee_max_cents bigint check (late_fee_max_cents >= 0),
  optimizer_enabled boolean not null default true,
  check (payment_mode <> 'AUTOPAY' or (late_fee_type = 'NONE' and allow_planned_late = false and optimizer_enabled = false)),
  check (last_safe_rule <> 'DAYS_AFTER_DUE' or last_safe_offset_days is not null),
  check (due_rule <> 'DAY_OF_MONTH' or due_day is not null),
  check (late_fee_min_cents is null or late_fee_max_cents is null or late_fee_min_cents <= late_fee_max_cents)
);

create table account_balance_snapshots (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  balance_as_of timestamptz not null,
  ledger_balance_cents bigint,
  available_balance_cents bigint,
  pending_transaction_cents bigint not null default 0 check (pending_transaction_cents >= 0),
  source text not null default 'MANUAL' check (source in ('MANUAL', 'BANK_FEED', 'FIXTURE')),
  unique (account_id, balance_as_of)
);

create table budgets (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  budget_key text not null,
  name text not null,
  cadence text not null default 'MONTHLY' check (cadence in ('MONTHLY', 'PAY_PERIOD', 'WEEKLY')),
  configured_allocation_cents bigint check (configured_allocation_cents >= 0),
  funding_account_id uuid references accounts(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (household_id, budget_key)
);

create table budget_periods (
  id uuid primary key default gen_random_uuid(),
  budget_id uuid not null references budgets(id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  allocation_amount_cents bigint not null check (allocation_amount_cents >= 0),
  check (ends_on >= starts_on),
  unique (budget_id, starts_on, ends_on)
);

create table budget_consumptions (
  id uuid primary key default gen_random_uuid(),
  budget_period_id uuid not null references budget_periods(id) on delete cascade,
  source_transaction_reference text not null,
  amount_cents bigint not null check (amount_cents > 0),
  allocated_on date not null,
  note text,
  unique (budget_period_id, source_transaction_reference)
);

create table reserves (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  reserve_key text not null,
  name text not null,
  target_amount_cents bigint check (target_amount_cents >= 0),
  reserve_type text not null check (reserve_type in ('VIRTUAL', 'PHYSICAL')),
  physical_account_id uuid references accounts(id),
  active boolean not null default true,
  unique (household_id, reserve_key),
  check (reserve_type <> 'PHYSICAL' or physical_account_id is not null)
);

create table reserve_movements (
  id uuid primary key default gen_random_uuid(),
  reserve_id uuid not null references reserves(id) on delete cascade,
  amount_cents bigint not null check (amount_cents > 0),
  direction text not null check (direction in ('FUND', 'RELEASE')),
  occurred_on date not null,
  related_obligation_occurrence_id uuid references obligation_occurrences(id) on delete set null,
  related_paycheck_occurrence_id uuid references paycheck_occurrences(id) on delete set null,
  from_account_id uuid references accounts(id),
  to_account_id uuid references accounts(id),
  note text,
  check (from_account_id is null or to_account_id is null or from_account_id <> to_account_id)
);

create index if not exists account_balance_snapshots_account_date_idx on account_balance_snapshots(account_id, balance_as_of desc);
create index if not exists budgets_household_active_idx on budgets(household_id, active);
create index if not exists budget_periods_budget_dates_idx on budget_periods(budget_id, starts_on, ends_on);
create index if not exists budget_consumptions_period_idx on budget_consumptions(budget_period_id);
create index if not exists reserves_household_active_idx on reserves(household_id, active);
create index if not exists reserve_movements_reserve_date_idx on reserve_movements(reserve_id, occurred_on);

create or replace function private.is_household_owner(target_household_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household_id and user_id = (select auth.uid()) and role = 'OWNER'
  );
$$;
revoke all on function private.is_household_owner(uuid) from public;
grant execute on function private.is_household_owner(uuid) to authenticated;

alter table household_financial_settings enable row level security;
alter table payment_policies enable row level security;
alter table account_balance_snapshots enable row level security;
alter table budgets enable row level security;
alter table budget_periods enable row level security;
alter table budget_consumptions enable row level security;
alter table reserves enable row level security;
alter table reserve_movements enable row level security;

alter table household_financial_settings force row level security;
alter table payment_policies force row level security;
alter table account_balance_snapshots force row level security;
alter table budgets force row level security;
alter table budget_periods force row level security;
alter table budget_consumptions force row level security;
alter table reserves force row level security;
alter table reserve_movements force row level security;

revoke all on table household_financial_settings, payment_policies, account_balance_snapshots, budgets,
  budget_periods, budget_consumptions, reserves, reserve_movements from anon, authenticated;
grant select on table household_financial_settings, payment_policies, account_balance_snapshots, budgets,
  budget_periods, budget_consumptions, reserves, reserve_movements to authenticated;

create policy household_settings_read on household_financial_settings for select to authenticated
  using (private.is_household_member(household_id));
create policy payment_policy_read on payment_policies for select to authenticated
  using (exists (select 1 from obligations o where o.id = obligation_id and private.is_household_member(o.household_id)));
create policy account_balance_read on account_balance_snapshots for select to authenticated
  using (exists (select 1 from accounts a where a.id = account_id and private.is_household_member(a.household_id)));
create policy budget_read on budgets for select to authenticated using (private.is_household_member(household_id));
create policy budget_owner_insert on budgets for insert to authenticated
  with check (private.is_household_owner(household_id));
create policy budget_owner_update on budgets for update to authenticated
  using (private.is_household_owner(household_id)) with check (private.is_household_owner(household_id));
create policy budget_period_read on budget_periods for select to authenticated
  using (exists (select 1 from budgets b where b.id = budget_id and private.is_household_member(b.household_id)));
create policy budget_consumption_read on budget_consumptions for select to authenticated
  using (exists (select 1 from budget_periods bp join budgets b on b.id = bp.budget_id where bp.id = budget_period_id and private.is_household_member(b.household_id)));
create policy reserve_read on reserves for select to authenticated using (private.is_household_member(household_id));
create policy reserve_movement_read on reserve_movements for select to authenticated
  using (exists (select 1 from reserves r where r.id = reserve_id and private.is_household_member(r.household_id)));

create or replace function public.save_budget_definition(
  p_household_id uuid,
  p_budget_id uuid,
  p_name text,
  p_cadence text,
  p_allocation_amount_cents bigint,
  p_active boolean
) returns uuid language plpgsql security definer set search_path = '' as $$
declare
  result_id uuid;
  period_start date := date_trunc('month', current_date)::date;
  period_end date := (date_trunc('month', current_date) + interval '1 month - 1 day')::date;
begin
  if not private.is_household_owner(p_household_id) then raise exception 'household owner access required'; end if;
  if nullif(trim(p_name),'') is null or length(trim(p_name)) > 80 then raise exception 'budget name is required and must be 80 characters or fewer'; end if;
  if p_cadence not in ('MONTHLY','PAY_PERIOD','WEEKLY') then raise exception 'unsupported budget cadence'; end if;
  if p_allocation_amount_cents is not null and p_allocation_amount_cents < 0 then raise exception 'budget allocation cannot be negative'; end if;

  if p_budget_id is null then
    insert into public.budgets (household_id, budget_key, name, cadence, configured_allocation_cents, active)
    values (p_household_id,
      trim(both '-' from regexp_replace(lower(trim(p_name)), '[^a-z0-9]+', '-', 'g')) || '-' || substr(gen_random_uuid()::text,1,8),
      trim(p_name), p_cadence, p_allocation_amount_cents, p_active)
    returning id into result_id;
  else
    update public.budgets set name=trim(p_name), cadence=p_cadence,
      configured_allocation_cents=p_allocation_amount_cents, active=p_active, updated_at=now()
    where id=p_budget_id and household_id=p_household_id returning id into result_id;
    if result_id is null then raise exception 'budget not found in household'; end if;
  end if;

  if p_active and p_allocation_amount_cents is not null and p_cadence = 'MONTHLY' then
    insert into public.budget_periods (budget_id, starts_on, ends_on, allocation_amount_cents)
    values (result_id, period_start, period_end, p_allocation_amount_cents)
    on conflict (budget_id, starts_on, ends_on) do update set allocation_amount_cents=excluded.allocation_amount_cents;
  end if;
  return result_id;
end;
$$;
revoke all on function public.save_budget_definition(uuid,uuid,text,text,bigint,boolean) from public, anon;
grant execute on function public.save_budget_definition(uuid,uuid,text,text,bigint,boolean) to authenticated;

create or replace function public.generate_paycheck_occurrences(
  p_household_id uuid, p_from date, p_through date
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  inserted_count integer := 0;
  unresolved_count integer := 0;
begin
  if p_from > p_through then raise exception 'generation start must not be after end'; end if;

  insert into public.paycheck_occurrences (income_source_id, expected_date, expected_amount_cents, status)
  select s.id, d::date, s.expected_net_amount_cents, 'EXPECTED'
  from public.income_sources s
  cross join lateral generate_series(s.anchor_date, p_through, make_interval(days => s.interval_days)) d
  where s.household_id = p_household_id and s.active and s.recurrence_type = 'INTERVAL_DAYS'
    and d::date between p_from and p_through
  on conflict (income_source_id, expected_date) do update
    set expected_amount_cents = excluded.expected_amount_cents;
  get diagnostics inserted_count = row_count;

  with month_starts as (
    select generate_series(date_trunc('month', p_from::timestamp), date_trunc('month', p_through::timestamp), interval '1 month')::date month_start
  ), candidates as (
    select s.id income_source_id, s.expected_net_amount_cents, s.date_adjustment_policy, m.month_start, day_number,
      extract(day from (m.month_start + interval '1 month - 1 day'))::integer last_day
    from public.income_sources s cross join month_starts m cross join lateral unnest(s.days_of_month) day_number
    where s.household_id = p_household_id and s.active and s.recurrence_type = 'MONTH_DAYS'
  ), valid_dates as (
    select income_source_id, expected_net_amount_cents,
      make_date(extract(year from month_start)::integer, extract(month from month_start)::integer,
        case when day_number <= last_day then day_number when date_adjustment_policy = 'LAST_DAY_OF_MONTH' then last_day end)::date expected_date,
      date_adjustment_policy
    from candidates where day_number <= last_day or date_adjustment_policy = 'LAST_DAY_OF_MONTH'
  ), adjusted_dates as (
    select income_source_id, expected_net_amount_cents,
      case
        when date_adjustment_policy = 'PREVIOUS_WEEKDAY' and extract(isodow from expected_date) = 6 then expected_date - 1
        when date_adjustment_policy = 'PREVIOUS_WEEKDAY' and extract(isodow from expected_date) = 7 then expected_date - 2
        when date_adjustment_policy = 'NEXT_WEEKDAY' and extract(isodow from expected_date) = 6 then expected_date + 2
        when date_adjustment_policy = 'NEXT_WEEKDAY' and extract(isodow from expected_date) = 7 then expected_date + 1
        else expected_date end final_date
    from valid_dates
  )
  insert into public.paycheck_occurrences (income_source_id, expected_date, expected_amount_cents, status)
  select income_source_id, final_date, expected_net_amount_cents, 'EXPECTED' from adjusted_dates
  where final_date between p_from and p_through
  on conflict (income_source_id, expected_date) do update set expected_amount_cents = excluded.expected_amount_cents;
  get diagnostics unresolved_count = row_count;
  inserted_count := inserted_count + unresolved_count;

  select count(*) into unresolved_count
  from public.income_sources s
  cross join lateral generate_series(date_trunc('month', p_from::timestamp), date_trunc('month', p_through::timestamp), interval '1 month') m
  cross join lateral unnest(s.days_of_month) day_number
  where s.household_id = p_household_id and s.active and s.recurrence_type = 'MONTH_DAYS'
    and day_number > extract(day from (m + interval '1 month - 1 day'))::integer
    and s.date_adjustment_policy is null;

  return jsonb_build_object('materialized', inserted_count, 'unresolvedInvalidCalendarDates', unresolved_count);
end;
$$;
revoke all on function public.generate_paycheck_occurrences(uuid, date, date) from public, anon, authenticated;
grant execute on function public.generate_paycheck_occurrences(uuid, date, date) to service_role;

-- An atomic, generic configuration loader. The JSON payload remains outside Git.
create or replace function public.apply_checkpoint1_config(p_household_id uuid, p_config jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  item jsonb;
  alias_item jsonb;
  period_item jsonb;
  account_id_value uuid;
  obligation_id_value uuid;
  budget_id_value uuid;
begin
  if not exists (select 1 from public.households where id = p_household_id) then raise exception 'unknown household'; end if;

  for item in select value from jsonb_array_elements(coalesce(p_config->'accounts', '[]'::jsonb)) loop
    insert into public.accounts (household_id, account_key, institution, name, account_type, purpose, is_active)
    values (p_household_id, item->>'key', item->>'institution', item->>'name', item->>'accountType', item->>'purpose', coalesce((item->>'active')::boolean, true))
    on conflict (household_id, account_key) do update set institution = excluded.institution, name = excluded.name,
      account_type = excluded.account_type, purpose = excluded.purpose, is_active = excluded.is_active;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(p_config->'incomeSources', '[]'::jsonb)) loop
    select id into account_id_value from public.accounts where household_id = p_household_id and account_key = item->>'destinationAccountKey';
    if account_id_value is null then raise exception 'unknown income destination account key: %', item->>'destinationAccountKey'; end if;
    insert into public.income_sources (household_id, person_label, cadence, destination_account_id, expected_net_amount_cents,
      tolerance_cents, active, recurrence_type, interval_days, anchor_date, days_of_month, date_adjustment_policy)
    values (p_household_id, item->>'personLabel', item->>'legacyCadence', account_id_value,
      nullif(item->>'expectedNetAmountCents','')::bigint, coalesce(nullif(item->>'toleranceCents','')::bigint,0),
      coalesce((item->>'active')::boolean,true), item->>'recurrenceType', nullif(item->>'intervalDays','')::integer,
      nullif(item->>'anchorDate','')::date,
      case when item ? 'daysOfMonth' then array(select jsonb_array_elements_text(item->'daysOfMonth')::smallint) else null end,
      nullif(item->>'dateAdjustmentPolicy',''))
    on conflict (household_id, person_label) do update set cadence = excluded.cadence,
      destination_account_id = excluded.destination_account_id, expected_net_amount_cents = excluded.expected_net_amount_cents,
      tolerance_cents = excluded.tolerance_cents, active = excluded.active, recurrence_type = excluded.recurrence_type,
      interval_days = excluded.interval_days, anchor_date = excluded.anchor_date, days_of_month = excluded.days_of_month,
      date_adjustment_policy = excluded.date_adjustment_policy;
  end loop;

  if p_config ? 'settings' then
    insert into public.household_financial_settings (household_id, safety_buffer_cents)
    values (p_household_id, nullif(p_config->'settings'->>'safetyBufferCents','')::bigint)
    on conflict (household_id) do update set safety_buffer_cents = excluded.safety_buffer_cents, updated_at = now();
  end if;

  for item in select value from jsonb_array_elements(coalesce(p_config->'obligations', '[]'::jsonb)) loop
    account_id_value := null;
    if nullif(item->>'accountKey','') is not null then
      select id into account_id_value from public.accounts where household_id = p_household_id and account_key = item->>'accountKey';
      if account_id_value is null then raise exception 'unknown obligation account key: %', item->>'accountKey'; end if;
    end if;
    insert into public.obligations (household_id, canonical_key, name, category, obligation_type, payment_type,
      paid_from_account_id, active, portable_across_contexts, amount_behavior, configuration_status)
    values (p_household_id, item->>'key', item->>'name', item->>'category', item->>'obligationType', item->>'paymentMode',
      account_id_value, coalesce((item->>'active')::boolean,true), coalesce((item->>'portableAcrossContexts')::boolean,false),
      coalesce(item->>'amountBehavior','UNKNOWN'), coalesce(item->>'configurationStatus','COMPLETE'))
    on conflict (household_id, canonical_key) do update set name=excluded.name, category=excluded.category,
      obligation_type=excluded.obligation_type, payment_type=excluded.payment_type, paid_from_account_id=excluded.paid_from_account_id,
      active=excluded.active, portable_across_contexts=excluded.portable_across_contexts,
      amount_behavior=excluded.amount_behavior, configuration_status=excluded.configuration_status
    returning id into obligation_id_value;

    if item ? 'paymentPolicy' then
      insert into public.payment_policies (obligation_id, payment_mode, due_rule, due_day, due_is_approximate, due_rule_text,
        last_safe_rule, last_safe_day, last_safe_offset_days, last_safe_rule_text, allow_planned_late, late_fee_type,
        late_fee_fixed_cents, late_fee_rate, late_fee_min_cents, late_fee_max_cents, optimizer_enabled)
      values (obligation_id_value, item->'paymentPolicy'->>'paymentMode', coalesce(item->'paymentPolicy'->>'dueRule','UNKNOWN'),
        nullif(item->'paymentPolicy'->>'dueDay','')::smallint, coalesce((item->'paymentPolicy'->>'dueIsApproximate')::boolean,false), item->'paymentPolicy'->>'dueRuleText',
        coalesce(item->'paymentPolicy'->>'lastSafeRule','UNKNOWN'), nullif(item->'paymentPolicy'->>'lastSafeDay','')::smallint,
        nullif(item->'paymentPolicy'->>'lastSafeOffsetDays','')::smallint, item->'paymentPolicy'->>'lastSafeRuleText',
        coalesce((item->'paymentPolicy'->>'allowPlannedLate')::boolean,false), coalesce(item->'paymentPolicy'->>'lateFeeType','NONE'),
        nullif(item->'paymentPolicy'->>'lateFeeFixedCents','')::bigint, nullif(item->'paymentPolicy'->>'lateFeeRate','')::numeric,
        nullif(item->'paymentPolicy'->>'lateFeeMinCents','')::bigint, nullif(item->'paymentPolicy'->>'lateFeeMaxCents','')::bigint,
        coalesce((item->'paymentPolicy'->>'optimizerEnabled')::boolean,true))
      on conflict (obligation_id) do update set payment_mode=excluded.payment_mode, due_rule=excluded.due_rule,
        due_day=excluded.due_day, due_is_approximate=excluded.due_is_approximate, due_rule_text=excluded.due_rule_text,
        last_safe_rule=excluded.last_safe_rule, last_safe_day=excluded.last_safe_day, last_safe_offset_days=excluded.last_safe_offset_days,
        last_safe_rule_text=excluded.last_safe_rule_text, allow_planned_late=excluded.allow_planned_late,
        late_fee_type=excluded.late_fee_type, late_fee_fixed_cents=excluded.late_fee_fixed_cents,
        late_fee_rate=excluded.late_fee_rate, late_fee_min_cents=excluded.late_fee_min_cents,
        late_fee_max_cents=excluded.late_fee_max_cents, optimizer_enabled=excluded.optimizer_enabled;
    end if;

    for alias_item in select value from jsonb_array_elements(coalesce(item->'aliases','[]'::jsonb)) loop
      insert into public.obligation_aliases (obligation_id, alias_type, alias_value, source, approved_at,
        effective_from, effective_to, match_account_id, amount_min_cents, amount_max_cents)
      values (obligation_id_value, alias_item->>'type', alias_item->>'value', coalesce(alias_item->>'source','USER_CONFIRMED_WORKSHEET'), now(),
        nullif(alias_item->>'effectiveFrom','')::date, nullif(alias_item->>'effectiveTo','')::date, account_id_value,
        nullif(alias_item->>'amountMinCents','')::bigint, nullif(alias_item->>'amountMaxCents','')::bigint)
      on conflict (obligation_id, alias_type, alias_value) do update set source=excluded.source, approved_at=excluded.approved_at,
        effective_from=excluded.effective_from, effective_to=excluded.effective_to, match_account_id=excluded.match_account_id,
        amount_min_cents=excluded.amount_min_cents, amount_max_cents=excluded.amount_max_cents;
    end loop;

    for period_item in select value from jsonb_array_elements(coalesce(item->'occurrences','[]'::jsonb)) loop
      insert into public.obligation_occurrences (obligation_id, period, expected_amount_cents, confirmed_amount_cents,
        due_date, last_safe_date, due_date_text, status, source_confidence)
      values (obligation_id_value, (period_item->>'period')::date, nullif(period_item->>'expectedAmountCents','')::bigint,
        nullif(period_item->>'confirmedAmountCents','')::bigint, nullif(period_item->>'dueDate','')::date,
        nullif(period_item->>'lastSafeDate','')::date, period_item->>'dueDateText', coalesce(period_item->>'status','CONFIRMED'), 'CONFIRMED')
      on conflict (obligation_id, period) where raw_import_row_id is null do update set
        expected_amount_cents=excluded.expected_amount_cents, confirmed_amount_cents=excluded.confirmed_amount_cents,
        due_date=excluded.due_date, last_safe_date=excluded.last_safe_date, due_date_text=excluded.due_date_text,
        status=excluded.status, source_confidence='CONFIRMED';
    end loop;
  end loop;

  for item in select value from jsonb_array_elements(coalesce(p_config->'budgets', '[]'::jsonb)) loop
    account_id_value := null;
    if nullif(item->>'accountKey','') is not null then
      select id into account_id_value from public.accounts where household_id = p_household_id and account_key = item->>'accountKey';
      if account_id_value is null then raise exception 'unknown budget account key: %', item->>'accountKey'; end if;
    end if;
    insert into public.budgets (household_id, budget_key, name, cadence, configured_allocation_cents, funding_account_id, active)
    values (p_household_id, item->>'key', item->>'name', coalesce(item->>'cadence','MONTHLY'),
      nullif(item->>'configuredAllocationCents','')::bigint, account_id_value, coalesce((item->>'active')::boolean,true))
    on conflict (household_id, budget_key) do update set name=excluded.name, cadence=excluded.cadence,
      configured_allocation_cents=excluded.configured_allocation_cents, funding_account_id=excluded.funding_account_id,
      active=excluded.active, updated_at=now()
    returning id into budget_id_value;
    for period_item in select value from jsonb_array_elements(coalesce(item->'periods','[]'::jsonb)) loop
      insert into public.budget_periods (budget_id, starts_on, ends_on, allocation_amount_cents)
      values (budget_id_value, (period_item->>'startsOn')::date, (period_item->>'endsOn')::date, (period_item->>'allocationAmountCents')::bigint)
      on conflict (budget_id, starts_on, ends_on) do update set allocation_amount_cents=excluded.allocation_amount_cents;
    end loop;
  end loop;

  return jsonb_build_object(
    'accounts', (select count(*) from public.accounts where household_id=p_household_id),
    'incomeSources', (select count(*) from public.income_sources where household_id=p_household_id),
    'obligations', (select count(*) from public.obligations where household_id=p_household_id),
    'budgets', (select count(*) from public.budgets where household_id=p_household_id)
  );
end;
$$;
revoke all on function public.apply_checkpoint1_config(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.apply_checkpoint1_config(uuid, jsonb) to service_role;
