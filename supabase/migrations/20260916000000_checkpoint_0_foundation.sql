-- Checkpoint 0 foundation. Financial amounts are integer cents; raw imports are immutable provenance.
create extension if not exists pgcrypto;

create table households (
  id uuid primary key default gen_random_uuid(), name text not null, created_at timestamptz not null default now()
);
create table financial_contexts (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id) on delete cascade,
  context_key text not null check (context_key in ('georgia-home', 'florida-home')), name text not null,
  starts_on date not null, ends_on date, is_current boolean not null default false,
  unique (household_id, context_key), check (ends_on is null or ends_on >= starts_on)
);
create unique index financial_contexts_one_current on financial_contexts(household_id) where is_current;
create table accounts (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id) on delete cascade,
  institution text not null, name text not null, account_type text not null, purpose text, is_active boolean not null default true,
  unique (household_id, institution, name)
);
create table income_sources (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id) on delete cascade,
  person_label text not null, cadence text not null check (cadence in ('BIWEEKLY_FRIDAY', 'SEMI_MONTHLY_15_30')),
  destination_account_id uuid references accounts(id), expected_net_amount_cents bigint check (expected_net_amount_cents >= 0), tolerance_cents bigint not null default 0 check (tolerance_cents >= 0), active boolean not null default true
);
create table paycheck_occurrences (
  id uuid primary key default gen_random_uuid(), income_source_id uuid not null references income_sources(id) on delete cascade,
  expected_date date not null, expected_amount_cents bigint not null check (expected_amount_cents >= 0), actual_date date, actual_amount_cents bigint check (actual_amount_cents >= 0), status text not null default 'EXPECTED' check (status in ('EXPECTED','CONFIRMED','VARIANCE_REVIEW')),
  unique (income_source_id, expected_date)
);
create table import_runs (
  id uuid primary key default gen_random_uuid(), household_id uuid references households(id) on delete set null,
  source_workbook text not null, source_sha256 text, importer_version text not null default 'checkpoint-0', status text not null default 'REHEARSAL' check (status in ('REHEARSAL','IMPORTED','FAILED')),
  started_at timestamptz not null default now(), completed_at timestamptz
);
create table raw_import_rows (
  id uuid primary key default gen_random_uuid(), import_run_id uuid not null references import_runs(id) on delete cascade,
  source_sheet text not null, source_row integer not null check (source_row > 0), source_range text not null,
  period date not null, context_key text not null check (context_key in ('georgia-home', 'florida-home')),
  column_limit integer not null default 22 check (column_limit = 22), raw_values jsonb not null, imported_at timestamptz not null default now(),
  unique (import_run_id, source_sheet, source_row)
);
create table obligations (
  id uuid primary key default gen_random_uuid(), household_id uuid not null references households(id) on delete cascade,
  name text not null, category text, obligation_type text, payment_type text, paid_from_account_id uuid references accounts(id), active boolean not null default true, portable_across_contexts boolean not null default false
);
create table obligation_aliases (
  id uuid primary key default gen_random_uuid(), obligation_id uuid not null references obligations(id) on delete cascade,
  alias_type text not null, alias_value text not null, source text not null, approved_at timestamptz,
  unique(obligation_id, alias_type, alias_value)
);
create table obligation_occurrences (
  id uuid primary key default gen_random_uuid(), obligation_id uuid not null references obligations(id) on delete cascade,
  raw_import_row_id uuid unique references raw_import_rows(id) on delete restrict,
  context_id uuid references financial_contexts(id), period date not null, expected_amount_cents bigint check (expected_amount_cents >= 0), confirmed_amount_cents bigint check (confirmed_amount_cents >= 0),
  due_date date, due_date_text text, status text not null default 'PROPOSED' check (status in ('PROPOSED','CONFIRMED','PAID','ON_TIME','PLANNED_LATE','UNPLANNED_LATE','AT_RISK','PAST_OPTIMAL_DATE')),
  source_confidence text not null default 'REVIEW_REQUIRED' check (source_confidence in ('REVIEW_REQUIRED','CONFIRMED','DERIVED'))
);
create table normalization_proposals (
  id uuid primary key default gen_random_uuid(), raw_import_row_id uuid not null references raw_import_rows(id) on delete cascade,
  proposal_kind text not null check (proposal_kind in ('OBLIGATION_OCCURRENCE','ALIAS')),
  proposed_values jsonb not null, confidence text not null default 'REVIEW_REQUIRED' check (confidence in ('REVIEW_REQUIRED','CONFIRMED')),
  reason text not null, status text not null default 'PENDING' check (status in ('PENDING','APPROVED','REJECTED')), created_at timestamptz not null default now()
);
create table planned_allocations (
  id uuid primary key default gen_random_uuid(), obligation_occurrence_id uuid not null references obligation_occurrences(id) on delete cascade,
  paycheck_occurrence_id uuid references paycheck_occurrences(id) on delete set null, amount_cents bigint not null check (amount_cents > 0)
);

-- Contexts deliberately establish the May 2026 financial break; source imports map by their period.
-- Insert a household first, then use these values during environment-specific seed/import setup.
