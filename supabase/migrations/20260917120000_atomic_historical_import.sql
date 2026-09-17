-- Atomic, replay-safe Checkpoint 0 import. The service-role-only function preserves
-- independent review proposals and never promotes or merges obligation identities.
create unique index import_runs_household_source_sha256_uidx
  on import_runs(household_id, source_sha256)
  where source_sha256 is not null;

create or replace function public.import_checkpoint0_workbook(
  p_household_id uuid,
  p_source_workbook text,
  p_source_sha256 text,
  p_payload jsonb
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run_id uuid;
  v_status text;
  v_raw_count integer;
  v_proposal_count integer;
  v_unmatched_count integer;
begin
  if p_source_workbook is null or btrim(p_source_workbook) = '' then
    raise exception 'source workbook is required';
  end if;
  if p_source_sha256 is null or p_source_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'source SHA-256 must be 64 lowercase hexadecimal characters';
  end if;
  if jsonb_typeof(p_payload -> 'raw_rows') is distinct from 'array'
    or jsonb_typeof(p_payload -> 'proposals') is distinct from 'array' then
    raise exception 'payload must contain raw_rows and proposals arrays';
  end if;
  if not exists (select 1 from public.households where id = p_household_id) then
    raise exception 'household does not exist';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_payload -> 'proposals') as p(proposal_kind text, confidence text)
    where p.confidence is distinct from 'REVIEW_REQUIRED'
      or p.proposal_kind is distinct from 'OBLIGATION_OCCURRENCE'
  ) then
    raise exception 'historical proposals must remain review-required obligation occurrences';
  end if;

  insert into public.import_runs (household_id, source_workbook, source_sha256, status)
  values (p_household_id, p_source_workbook, p_source_sha256, 'REHEARSAL')
  on conflict (household_id, source_sha256) where source_sha256 is not null do nothing
  returning id into v_run_id;

  if v_run_id is null then
    select id, status into v_run_id, v_status
    from public.import_runs
    where household_id = p_household_id and source_sha256 = p_source_sha256;
    if v_status <> 'IMPORTED' then
      raise exception 'an incomplete import already exists for this source SHA-256';
    end if;
    select count(*) into v_raw_count from public.raw_import_rows where import_run_id = v_run_id;
    select count(*) into v_proposal_count
    from public.normalization_proposals p
    join public.raw_import_rows r on r.id = p.raw_import_row_id
    where r.import_run_id = v_run_id;
    return jsonb_build_object('importRunId', v_run_id, 'alreadyImported', true, 'rawRows', v_raw_count, 'proposals', v_proposal_count);
  end if;

  insert into public.raw_import_rows (
    import_run_id, source_sheet, source_row, source_range, period,
    context_key, column_limit, raw_values
  )
  select
    v_run_id, r.source_sheet, r.source_row, r.source_range, r.period,
    r.context_key, r.column_limit, r.raw_values
  from jsonb_to_recordset(p_payload -> 'raw_rows') as r(
    source_sheet text, source_row integer, source_range text, period date,
    context_key text, column_limit integer, raw_values jsonb
  );
  get diagnostics v_raw_count = row_count;

  select count(*) into v_unmatched_count
  from jsonb_to_recordset(p_payload -> 'proposals') as p(raw_row_key text)
  left join public.raw_import_rows r
    on r.import_run_id = v_run_id
    and concat(r.source_sheet, ':', r.source_row) = p.raw_row_key
  where r.id is null;
  if v_unmatched_count > 0 then
    raise exception '% proposal rows do not match imported raw provenance', v_unmatched_count;
  end if;

  insert into public.normalization_proposals (
    raw_import_row_id, proposal_kind, proposed_values, confidence, reason
  )
  select r.id, p.proposal_kind, p.proposed_values, p.confidence, p.reason
  from jsonb_to_recordset(p_payload -> 'proposals') as p(
    raw_row_key text, proposal_kind text, proposed_values jsonb,
    confidence text, reason text
  )
  join public.raw_import_rows r
    on r.import_run_id = v_run_id
    and concat(r.source_sheet, ':', r.source_row) = p.raw_row_key;
  get diagnostics v_proposal_count = row_count;

  update public.import_runs
  set status = 'IMPORTED', completed_at = now()
  where id = v_run_id;

  return jsonb_build_object('importRunId', v_run_id, 'alreadyImported', false, 'rawRows', v_raw_count, 'proposals', v_proposal_count);
end;
$$;

revoke all on function public.import_checkpoint0_workbook(uuid, text, text, jsonb) from public, anon, authenticated;
grant execute on function public.import_checkpoint0_workbook(uuid, text, text, jsonb) to service_role;
