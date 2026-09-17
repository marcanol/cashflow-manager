-- Passwordless users are managed by Supabase Auth. This mapping is the tenant boundary.
create table household_members (
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'MEMBER' check (role in ('OWNER', 'MEMBER')),
  created_at timestamptz not null default now(),
  primary key (household_id, user_id)
);
create index household_members_user_id_idx on household_members(user_id);

-- Every retained import must have an owning household; otherwise it cannot be safely authorized.
alter table import_runs alter column household_id set not null;

create schema if not exists private;
create or replace function private.is_household_member(target_household_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.household_members
    where household_id = target_household_id and user_id = (select auth.uid())
  );
$$;
revoke all on function private.is_household_member(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_household_member(uuid) to authenticated;

alter table households enable row level security;
alter table household_members enable row level security;
alter table financial_contexts enable row level security;
alter table accounts enable row level security;
alter table income_sources enable row level security;
alter table paycheck_occurrences enable row level security;
alter table import_runs enable row level security;
alter table raw_import_rows enable row level security;
alter table obligations enable row level security;
alter table obligation_aliases enable row level security;
alter table obligation_occurrences enable row level security;
alter table normalization_proposals enable row level security;
alter table planned_allocations enable row level security;

alter table households force row level security;
alter table household_members force row level security;
alter table financial_contexts force row level security;
alter table accounts force row level security;
alter table income_sources force row level security;
alter table paycheck_occurrences force row level security;
alter table import_runs force row level security;
alter table raw_import_rows force row level security;
alter table obligations force row level security;
alter table obligation_aliases force row level security;
alter table obligation_occurrences force row level security;
alter table normalization_proposals force row level security;
alter table planned_allocations force row level security;

-- Checkpoint 0's browser surface is read-only. Administrative imports use a server-only
-- secret/service-role key. Future write workflows must add explicit grants and policies.
revoke all on table households, household_members, financial_contexts, accounts, income_sources,
  paycheck_occurrences, import_runs, raw_import_rows, obligations, obligation_aliases,
  obligation_occurrences, normalization_proposals, planned_allocations from anon, authenticated;
grant select on table households, household_members, financial_contexts, accounts, income_sources,
  paycheck_occurrences, import_runs, raw_import_rows, obligations, obligation_aliases,
  obligation_occurrences, normalization_proposals, planned_allocations to authenticated;

create index income_sources_household_id_idx on income_sources(household_id);
create index paycheck_occurrences_income_source_id_idx on paycheck_occurrences(income_source_id);
create index import_runs_household_id_idx on import_runs(household_id);
create index raw_import_rows_import_run_id_idx on raw_import_rows(import_run_id);
create index obligations_household_id_idx on obligations(household_id);
create index obligation_aliases_obligation_id_idx on obligation_aliases(obligation_id);
create index obligation_occurrences_obligation_id_idx on obligation_occurrences(obligation_id);
create index normalization_proposals_raw_row_id_idx on normalization_proposals(raw_import_row_id);
create index planned_allocations_occurrence_id_idx on planned_allocations(obligation_occurrence_id);
create index planned_allocations_paycheck_id_idx on planned_allocations(paycheck_occurrence_id);

create policy household_member_access on households for select to authenticated
  using (private.is_household_member(id));
create policy own_membership_read on household_members for select to authenticated using (user_id = (select auth.uid()));
create policy direct_context_access on financial_contexts for select to authenticated
  using (private.is_household_member(household_id));
create policy direct_account_access on accounts for select to authenticated
  using (private.is_household_member(household_id));
create policy direct_income_source_access on income_sources for select to authenticated
  using (private.is_household_member(household_id));
create policy paycheck_household_access on paycheck_occurrences for select to authenticated
  using (exists (select 1 from income_sources s where s.id = income_source_id and private.is_household_member(s.household_id)));
create policy direct_import_run_access on import_runs for select to authenticated
  using (private.is_household_member(household_id));
create policy raw_row_household_access on raw_import_rows for select to authenticated
  using (exists (select 1 from import_runs r where r.id = import_run_id and private.is_household_member(r.household_id)));
create policy direct_obligation_access on obligations for select to authenticated
  using (private.is_household_member(household_id));
create policy alias_household_access on obligation_aliases for select to authenticated
  using (exists (select 1 from obligations o where o.id = obligation_id and private.is_household_member(o.household_id)));
create policy occurrence_household_access on obligation_occurrences for select to authenticated
  using (exists (select 1 from obligations o where o.id = obligation_id and private.is_household_member(o.household_id)));
create policy proposal_household_access on normalization_proposals for select to authenticated
  using (exists (select 1 from raw_import_rows rr join import_runs r on r.id = rr.import_run_id where rr.id = raw_import_row_id and private.is_household_member(r.household_id)));
create policy allocation_household_access on planned_allocations for select to authenticated
  using (
    exists (select 1 from obligation_occurrences oo join obligations o on o.id = oo.obligation_id where oo.id = obligation_occurrence_id and private.is_household_member(o.household_id))
    and (paycheck_occurrence_id is null or exists (select 1 from paycheck_occurrences p join income_sources s on s.id = p.income_source_id where p.id = paycheck_occurrence_id and private.is_household_member(s.household_id)))
  );
