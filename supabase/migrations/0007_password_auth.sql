-- Password sign-in, and invitations that do not depend on sending email.
--
-- The program cannot rely on an email service, so nobody is invited by email
-- and nobody resets a password by email. An admin generates a single-use link
-- and delivers it however they like. The link is the credential, so only its
-- hash is stored here and it expires.

create table if not exists public.invite_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  token_hash text not null unique,
  purpose text not null check (purpose in ('invite', 'reset')),
  created_by uuid references public.users (id),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz
);

create index if not exists invite_tokens_user_idx on public.invite_tokens (user_id);

-- No policies at all: this table is only ever touched by the service role, on
-- the server. A browser session must never be able to read a pending token.
alter table public.invite_tokens enable row level security;

-- Tracks whether the person has ever set a password, so the admin list can
-- show who still needs their invite link sent.
alter table public.users add column if not exists password_set_at timestamptz;

insert into public.applied_migrations (filename) values ('0007_password_auth.sql')
  on conflict (filename) do nothing;
