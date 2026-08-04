-- Admin tooling: account status, and letting the app write its own audit trail.

alter table users add column status text not null default 'active';

-- The audit log is the who-knew-what-when record. Rows are written by the
-- signed-in actor and are never updated or deleted (no such policies exist).
create policy audit_insert on audit_log for insert
  with check (actor_id = current_app_user());

-- Instructors may read their cohort's audit entries; admins read everything.
drop policy if exists audit_admin_read on audit_log;
create policy audit_staff_read on audit_log for select
  using (current_app_role() in ('admin', 'instructor'));

create index if not exists audit_log_created_idx on audit_log (created_at desc);
create index if not exists users_role_idx on users (role);
