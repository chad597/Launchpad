-- Security fixes found in the August 2026 QA pass. Every item here is a
-- production-only issue: demo mode never exercises row-level security.

-- ===== 1. Privilege escalation =====
-- 0002 granted every signed-in user UPDATE on their whole users row so mentors
-- could edit availability. RLS cannot restrict columns, so a founder holding
-- the public anon key could PATCH their own role to 'admin'. Replaced with a
-- trigger that pins the fields only staff may change.

drop policy if exists users_self_update on users;

create or replace function guard_self_update()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare actor_role user_role;
begin
  select role into actor_role from public.users where auth_user_id = auth.uid();
  if actor_role = 'admin' then
    return new;
  end if;
  -- Anyone editing their own row keeps the values they are not allowed to set.
  new.role := old.role;
  new.status := old.status;
  new.email := old.email;
  new.auth_user_id := old.auth_user_id;
  new.hubspot_contact_id := old.hubspot_contact_id;
  return new;
end $$;

create trigger users_guard_self_update
  before update on users
  for each row execute function guard_self_update();

create policy users_self_update on users for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- ===== 2. Everyone could read everyone =====
-- The original policy exposed every column to every session, and 0004 then
-- added phone, linkedin, story, conflicts, mentor_motivation and
-- profile_answers to that same table. Conflicts in particular are solicited
-- as a confidential disclosure. Narrow reads to people you actually work with.

drop policy if exists users_read on users;

create policy users_read_self on users for select
  using (auth_user_id = auth.uid());

create policy users_read_staff on users for select
  using (current_app_role() in ('admin', 'instructor'));

-- Your counterpart in an active pairing, so names and profiles still render.
create policy users_read_counterpart on users for select
  using (exists (
    select 1 from pairings p
    where p.status = 'active'
      and ((p.founder_id = users.id and p.mentor_id = current_app_user())
        or (p.mentor_id = users.id and p.founder_id = current_app_user()))
  ));

-- Mentors in this cohort's 1:1 pool are visible to that cohort's founders,
-- which is what the matching and profile screens need.
create policy users_read_pool on users for select
  using (exists (
    select 1 from cohort_mentor_pool cp
    join cohort_members cm on cm.cohort_id = cp.cohort_id
    where cp.mentor_id = users.id and cm.user_id = current_app_user()
  ));

-- ===== 3. Writes the app makes that RLS silently rejected =====
-- cohort_members had only a SELECT policy, so importing founders into a cohort
-- appeared to succeed and did nothing.

create policy members_staff_write on cohort_members for all
  using (current_app_role() = 'admin')
  with check (current_app_role() = 'admin');

-- Every email send inserts a notifications row; there was no insert policy,
-- so the entire send log was being discarded.
create policy notifications_insert on notifications for insert
  with check (auth.uid() is not null);
create policy notifications_staff_read on notifications for select
  using (current_app_role() = 'admin');

-- Only a mentor may add themselves to a pool, and only for themselves.
drop policy if exists pool_self on cohort_mentor_pool;
create policy pool_self on cohort_mentor_pool for insert
  with check (mentor_id = current_app_user() and current_app_role() = 'mentor');

-- ===== 4. Public application submissions =====
-- `with check (true)` let anyone POST an application already marked accepted.
drop policy if exists applications_public_insert on mentor_applications;
create policy applications_public_insert on mentor_applications for insert
  with check (
    status = 'new'
    and reviewed_by is null
    and reviewed_at is null
    and invited_user_id is null
  );

-- ===== 5. Pin search_path on the security definer functions =====
-- Without this, a caller can shadow the tables these functions read and
-- subvert every authorization check built on them.
create or replace function current_app_user() returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select id from public.users where auth_user_id = auth.uid()
$$;

create or replace function current_app_role() returns user_role
language sql stable security definer set search_path = public, pg_temp as $$
  select role from public.users where auth_user_id = auth.uid()
$$;

create or replace function in_pairing(p uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.pairings
    where id = p and (founder_id = current_app_user() or mentor_id = current_app_user())
  )
$$;

create or replace function link_auth_user()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
begin
  update public.users set auth_user_id = new.id
  where email = new.email and auth_user_id is null;
  return new;
end $$;

-- ===== 6. Meeting notes follow the same rule as the rest of the pair data =====
-- Instructors own cohort quality and may read notes; they still have no
-- access to messages, which was an explicit program decision.
drop policy if exists notes_read on meeting_notes;
create policy notes_read on meeting_notes for select
  using (
    exists (select 1 from meetings m where m.id = meeting_id and in_pairing(m.pairing_id))
    or current_app_role() in ('admin', 'instructor')
  );
