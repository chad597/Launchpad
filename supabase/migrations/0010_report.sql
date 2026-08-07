-- The consolidated cohort report's stored narrative.
--
-- Every table and number on /admin/report is computed from live data at
-- render time. Only the written narrative is stored, one row per cohort per
-- week, so it is generated once, can be regenerated deliberately, and the
-- report reads the same on Friday as it did on Monday.
create table if not exists cohort_reports (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references cohorts (id),
  week_start date not null,
  narrative jsonb not null,
  model text,
  generated_by uuid references users (id),
  generated_at timestamptz not null default now(),
  unique (cohort_id, week_start)
);

alter table cohort_reports enable row level security;

-- Staff-only in both directions: the report quotes blockers across the whole
-- cohort, which no founder or mentor should read about anyone else.
create policy cohort_reports_staff on cohort_reports for all using (
  current_app_role() = 'admin'
);

insert into public.applied_migrations (filename) values ('0010_report.sql')
  on conflict (filename) do nothing;
