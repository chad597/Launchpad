-- Fixes the self-update guard added in 0005.
--
-- The trigger pinned role, status and email whenever the caller was not an
-- admin, but it read the caller from auth.uid(). Direct SQL, migrations, and
-- the service role key all have a NULL auth.uid(), so those legitimate
-- privileged paths were being silently reverted: a role change made in the
-- SQL editor appeared to succeed and did nothing.
--
-- Letting a NULL auth.uid() through is safe. An anonymous request cannot
-- reach this trigger at all, because the users_self_update policy requires
-- auth_user_id = auth.uid(), which is never true when auth.uid() is NULL.
-- The only callers with no auth context are the service role and direct SQL,
-- both of which are already trusted.

create or replace function guard_self_update()
returns trigger language plpgsql security definer
set search_path = public, pg_temp as $$
declare actor_role user_role;
begin
  -- No auth context means service role or direct SQL. RLS has already blocked
  -- anonymous callers, so this is a trusted path.
  if auth.uid() is null then
    return new;
  end if;

  select role into actor_role from public.users where auth_user_id = auth.uid();
  if actor_role = 'admin' then
    return new;
  end if;

  -- A signed-in non-admin keeps the values only staff may change.
  new.role := old.role;
  new.status := old.status;
  new.email := old.email;
  new.auth_user_id := old.auth_user_id;
  new.hubspot_contact_id := old.hubspot_contact_id;
  return new;
end $$;
