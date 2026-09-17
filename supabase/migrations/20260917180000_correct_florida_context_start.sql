-- Correct the household move boundary: Florida/current-home context begins May 2026.
-- Existing raw provenance is preserved; only its deterministic context classification changes.
begin;

update public.financial_contexts
set ends_on = date '2026-04-30'
where context_key = 'georgia-home';

update public.financial_contexts
set starts_on = date '2026-05-01'
where context_key = 'florida-home';

update public.raw_import_rows
set context_key = case
  when period >= date '2026-05-01' then 'florida-home'
  else 'georgia-home'
end;

update public.obligation_occurrences occurrence
set context_id = context.id
from public.obligations obligation
join public.financial_contexts context
  on context.household_id = obligation.household_id
where occurrence.obligation_id = obligation.id
  and context.context_key = case
    when occurrence.period >= date '2026-05-01' then 'florida-home'
    else 'georgia-home'
  end;

commit;
