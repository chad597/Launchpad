-- Mentor App schema, per spec v1.5.
-- Apply to the Launchpad Supabase project once it exists:
--   supabase db push   (or paste via the MCP apply_migration tool)

create type user_role as enum ('founder', 'mentor', 'instructor', 'admin');
create type pairing_status as enum ('proposed', 'active', 'paused', 'completed', 'dissolved');
create type meeting_status as enum ('scheduled', 'completed', 'no_show', 'canceled');
create type status_flag as enum ('on_track', 'at_risk', 'off_track');
create type action_item_status as enum ('open', 'done', 'dropped');
create type cadence as enum ('weekly', 'biweekly', 'monthly', 'as_needed');
create type flag_category as enum ('pattern_risk', 'match_not_working', 'conduct', 'other');
create type suggestion_status as enum ('suggested', 'selected', 'rejected');

-- People are seeded from HubSpot before they ever log in, so app users are
-- keyed independently of auth.users and linked by email on first sign-in.
create table users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users (id),
  email text unique not null,
  name text not null,
  role user_role not null,
  company text,
  stage text,
  bio text,
  expertise text[],
  hubspot_contact_id text,
  invited_at timestamptz,
  terms_accepted_at timestamptz,
  terms_version text,
  created_at timestamptz not null default now()
);

create table ecosystems (
  id uuid primary key default gen_random_uuid(),
  name text unique not null,
  host text,
  status text not null default 'active'
);

create table cohorts (
  id uuid primary key default gen_random_uuid(),
  ecosystem_id uuid not null references ecosystems (id),
  name text not null,
  start_date date not null,
  status text not null default 'intake',
  created_at timestamptz not null default now()
);

create table cohort_members (
  cohort_id uuid not null references cohorts (id),
  user_id uuid not null references users (id),
  primary key (cohort_id, user_id)
);

-- Mentors who volunteered for 1:1 matching this cohort: the matching pool.
create table cohort_mentor_pool (
  cohort_id uuid not null references cohorts (id),
  mentor_id uuid not null references users (id),
  capacity int not null default 1,
  volunteered_at timestamptz not null default now(),
  primary key (cohort_id, mentor_id)
);

create table questionnaire_responses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id),
  source text not null default 'typeform',
  version text,
  answers jsonb not null,
  submitted_at timestamptz not null default now()
);

create table match_suggestions (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references cohorts (id),
  founder_id uuid not null references users (id),
  mentor_id uuid not null references users (id),
  score numeric not null,
  breakdown jsonb not null default '[]',
  rationale text,
  rank int,
  status suggestion_status not null default 'suggested',
  created_at timestamptz not null default now()
);

create table pairings (
  id uuid primary key default gen_random_uuid(),
  cohort_id uuid not null references cohorts (id),
  founder_id uuid not null references users (id),
  mentor_id uuid not null references users (id),
  status pairing_status not null default 'proposed',
  declared_cadence cadence,
  match_rationale text,
  first_contact_owner uuid references users (id),
  first_contact_deadline date,
  started_at timestamptz,
  ended_at timestamptz,
  end_reason text,
  created_at timestamptz not null default now()
);

create table meetings (
  id uuid primary key default gen_random_uuid(),
  pairing_id uuid not null references pairings (id),
  scheduled_at timestamptz not null,
  status meeting_status not null default 'scheduled',
  gcal_event_id text,
  video_link text,
  week_number int,
  created_at timestamptz not null default now()
);

-- One shared note per meeting, both halves visible to both parties.
-- No admin-only fields; concerns go through flags instead.
create table meeting_notes (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid unique not null references meetings (id),
  status_flag status_flag,
  confidence int check (confidence between 1 and 10),
  founder_section jsonb,
  mentor_section jsonb,
  key_insight text,
  decision_made text,
  founder_submitted_at timestamptz,
  mentor_submitted_at timestamptz
);

create table action_items (
  id uuid primary key default gen_random_uuid(),
  meeting_id uuid not null references meetings (id),
  pairing_id uuid not null references pairings (id),
  description text not null,
  owner_id uuid not null references users (id),
  due_date date,
  status action_item_status not null default 'open',
  completed_at timestamptz,
  created_at timestamptz not null default now()
);

-- Append-only: no update/delete policies are granted below.
create table messages (
  id uuid primary key default gen_random_uuid(),
  pairing_id uuid not null references pairings (id),
  sender_id uuid not null references users (id),
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create table files (
  id uuid primary key default gen_random_uuid(),
  pairing_id uuid not null references pairings (id),
  uploader_id uuid not null references users (id),
  name text not null,
  storage_path text not null,
  size_bytes bigint,
  hidden_at timestamptz,
  created_at timestamptz not null default now()
);

create table flags (
  id uuid primary key default gen_random_uuid(),
  raised_by uuid not null references users (id),
  pairing_id uuid references pairings (id),
  category flag_category not null default 'other',
  body text not null,
  status text not null default 'open',
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create table pulse_responses (
  id uuid primary key default gen_random_uuid(),
  pairing_id uuid not null references pairings (id),
  user_id uuid not null references users (id),
  week int not null,
  value_score int not null check (value_score between 1 and 5),
  comment text,
  submitted_at timestamptz not null default now()
);

-- Sequential continuation: the founder row is only created after a mentor yes.
create table continuation_responses (
  id uuid primary key default gen_random_uuid(),
  pairing_id uuid not null references pairings (id),
  user_id uuid not null references users (id),
  wants_continuation boolean not null,
  note text,
  submitted_at timestamptz not null default now(),
  unique (pairing_id, user_id)
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users (id),
  type text not null,
  payload jsonb not null default '{}',
  channel text not null default 'email',
  sent_at timestamptz,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

-- Append-only audit log; admin reads of pair messages are recorded here too.
create table audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid references users (id),
  action text not null,
  subject_type text not null,
  subject_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Link auth sign-ins to seeded people by email.
create or replace function link_auth_user()
returns trigger language plpgsql security definer as $$
begin
  update public.users set auth_user_id = new.id
  where email = new.email and auth_user_id is null;
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function link_auth_user();

-- ===== Row-level security =====
alter table users enable row level security;
alter table ecosystems enable row level security;
alter table cohorts enable row level security;
alter table cohort_members enable row level security;
alter table cohort_mentor_pool enable row level security;
alter table questionnaire_responses enable row level security;
alter table match_suggestions enable row level security;
alter table pairings enable row level security;
alter table meetings enable row level security;
alter table meeting_notes enable row level security;
alter table action_items enable row level security;
alter table messages enable row level security;
alter table files enable row level security;
alter table flags enable row level security;
alter table pulse_responses enable row level security;
alter table continuation_responses enable row level security;
alter table notifications enable row level security;
alter table audit_log enable row level security;

create or replace function current_app_user() returns uuid
language sql stable security definer as $$
  select id from public.users where auth_user_id = auth.uid()
$$;

create or replace function current_app_role() returns user_role
language sql stable security definer as $$
  select role from public.users where auth_user_id = auth.uid()
$$;

create or replace function in_pairing(p uuid) returns boolean
language sql stable security definer as $$
  select exists (
    select 1 from public.pairings
    where id = p and (founder_id = current_app_user() or mentor_id = current_app_user())
  )
$$;

-- Everyone signed in can see basic person records (names power every screen);
-- writes are staff-only. Instructors see everything in their cohort EXCEPT
-- messages; messages are pair members + admin only.
create policy users_read on users for select using (auth.uid() is not null);
create policy users_admin_write on users for all using (current_app_role() = 'admin');

create policy ecosystems_read on ecosystems for select using (auth.uid() is not null);
create policy cohorts_read on cohorts for select using (auth.uid() is not null);
create policy staff_write_ecosystems on ecosystems for all using (current_app_role() = 'admin');
create policy staff_write_cohorts on cohorts for all using (current_app_role() = 'admin');

create policy members_read on cohort_members for select using (auth.uid() is not null);
create policy pool_read on cohort_mentor_pool for select using (current_app_role() in ('admin','instructor'));
create policy pool_self on cohort_mentor_pool for insert with check (mentor_id = current_app_user());
create policy staff_pool on cohort_mentor_pool for all using (current_app_role() = 'admin');

create policy qr_own on questionnaire_responses for select using (user_id = current_app_user() or current_app_role() in ('admin','instructor'));
create policy qr_insert on questionnaire_responses for insert with check (user_id = current_app_user() or current_app_role() = 'admin');

create policy suggestions_staff on match_suggestions for all using (current_app_role() = 'admin');

create policy pairings_read on pairings for select
  using (founder_id = current_app_user() or mentor_id = current_app_user() or current_app_role() in ('admin','instructor'));
create policy pairings_admin on pairings for all using (current_app_role() = 'admin');

create policy meetings_read on meetings for select
  using (in_pairing(pairing_id) or current_app_role() in ('admin','instructor'));
create policy meetings_write on meetings for insert with check (in_pairing(pairing_id) or current_app_role() = 'admin');
create policy meetings_update on meetings for update using (in_pairing(pairing_id) or current_app_role() = 'admin');

create policy notes_read on meeting_notes for select
  using (exists (select 1 from meetings m where m.id = meeting_id and in_pairing(m.pairing_id))
         or current_app_role() in ('admin','instructor'));
create policy notes_write on meeting_notes for insert
  with check (exists (select 1 from meetings m where m.id = meeting_id and in_pairing(m.pairing_id)));
create policy notes_update on meeting_notes for update
  using (exists (select 1 from meetings m where m.id = meeting_id and in_pairing(m.pairing_id)));

create policy items_read on action_items for select
  using (in_pairing(pairing_id) or current_app_role() in ('admin','instructor'));
create policy items_write on action_items for insert with check (in_pairing(pairing_id));
create policy items_update on action_items for update using (in_pairing(pairing_id));

-- Messages: pair members + admin ONLY. Instructors have no message access
-- (decided 2026-08-03). Append-only: no update or delete policy exists.
create policy messages_read on messages for select
  using (in_pairing(pairing_id) or current_app_role() = 'admin');
create policy messages_insert on messages for insert
  with check (in_pairing(pairing_id) and sender_id = current_app_user());

create policy files_read on files for select
  using ((in_pairing(pairing_id) and hidden_at is null) or current_app_role() = 'admin');
create policy files_insert on files for insert
  with check (in_pairing(pairing_id) and uploader_id = current_app_user());

create policy flags_own on flags for select
  using (raised_by = current_app_user() or current_app_role() in ('admin','instructor'));
create policy flags_insert on flags for insert with check (raised_by = current_app_user());
create policy flags_admin on flags for update using (current_app_role() = 'admin');

create policy pulse_own on pulse_responses for select
  using (user_id = current_app_user() or current_app_role() = 'admin');
create policy pulse_insert on pulse_responses for insert with check (user_id = current_app_user());

-- Continuation answers are never visible to the other party.
create policy continuation_own on continuation_responses for select
  using (user_id = current_app_user() or current_app_role() = 'admin');
create policy continuation_insert on continuation_responses for insert with check (user_id = current_app_user());

create policy notifications_own on notifications for select using (user_id = current_app_user());

create policy audit_admin_read on audit_log for select using (current_app_role() = 'admin');
-- audit rows are written by the service role only; no insert policy for users.
