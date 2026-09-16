-- Development-only structural seed. Contains no real financial data.
insert into households (id, name) values ('00000000-0000-0000-0000-000000000001', 'Local development household')
on conflict (id) do update set name = excluded.name;

insert into financial_contexts (household_id, context_key, name, starts_on, ends_on, is_current) values
  ('00000000-0000-0000-0000-000000000001', 'georgia-home', 'Georgia home', '1900-01-01', '2026-06-30', false),
  ('00000000-0000-0000-0000-000000000001', 'florida-home', 'Florida home', '2026-07-01', null, true)
on conflict (household_id, context_key) do update set name = excluded.name, starts_on = excluded.starts_on, ends_on = excluded.ends_on, is_current = excluded.is_current;
