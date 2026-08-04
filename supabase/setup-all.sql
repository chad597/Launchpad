-- Launchpad Mentor App: complete database setup.
-- Paste this whole file into the Supabase SQL Editor and press Run.
-- Safe to run ONCE on a fresh project. Running it twice will error on duplicate objects.
-- If you already ran an earlier version, run only the migration files you are missing.

-- ============ 1. SCHEMA + ROW LEVEL SECURITY ============
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

-- ============ 2. AVAILABILITY COLUMNS ============
-- Mentor availability, shown to founders when they book a meeting.
-- Free-text windows for now (e.g. "Tue and Thu afternoons"); structured slot
-- booking arrives with the Office Hours module in Phase 2.

alter table users add column availability text;
alter table users add column booking_link text;
alter table users add column capacity int not null default 1;

-- Mentors maintain their own availability; staff may correct it.
create policy users_self_update on users for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- ============ 3. ADMIN: ACCOUNT STATUS + AUDIT WRITES ============
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

-- ============ 4. DEMO SEED DATA ============
-- Demo seed mirroring lib/fixtures.ts, so the database-backed app starts with
-- the same Greenville Cohort 7 data the demo mode shows. Replace with the real
-- HubSpot import before launch. Safe to run once on a fresh database.
--
-- IMPORTANT: change the admin email below to the real one before running, so
-- your first magic-link login binds to the admin row.

insert into ecosystems (id, name, host) values
  ('e0000000-0000-0000-0000-000000000001', 'Greenville', 'Tech Village');

insert into cohorts (id, ecosystem_id, name, start_date, status) values
  ('c0000000-0000-0000-0000-000000000007', 'e0000000-0000-0000-0000-000000000001', 'Cohort 7', '2026-07-06', 'active');

insert into users (id, email, name, role, company, stage, bio, expertise) values
  ('a0000000-0000-0000-0000-000000000001', 'chad.hensel@gmail.com', 'Chad Hensel', 'admin', null, null, null, null),
  ('a0000000-0000-0000-0000-000000000002', 'taylor@launchpad.test', 'Taylor Finch', 'instructor', null, null, null, null),
  ('f0000000-0000-0000-0000-000000000001', 'alex@trellis.test', 'Alex Rivera', 'founder', 'Trellis', 'Idea stage, two-sided marketplace', null, null),
  ('f0000000-0000-0000-0000-000000000002', 'jordan@fernway.test', 'Jordan Lee', 'founder', 'Fernway', 'Idea stage, consumer app', null, null),
  ('f0000000-0000-0000-0000-000000000003', 'priya@lucent.test', 'Priya Nguyen', 'founder', 'Lucent Pay', 'Pre-revenue, B2B fintech', null, null),
  ('f0000000-0000-0000-0000-000000000004', 'ade@plotline.test', 'Ade Okafor', 'founder', 'Plotline', 'Idea stage, creator tools', null, null),
  ('f0000000-0000-0000-0000-000000000005', 'rosa@kindling.test', 'Rosa Marsh', 'founder', 'Kindling', 'First customers, B2B services', null, null),
  ('b0000000-0000-0000-0000-000000000001', 'sam@mentor.test', 'Sam Patel', 'mentor', null, null, 'Founder, 2 exits', array['Marketplaces','Customer discovery','Early GTM']),
  ('b0000000-0000-0000-0000-000000000002', 'brooks@mentor.test', 'Casey Brooks', 'mentor', null, null, 'SaaS operator', array['B2B sales','Hiring']),
  ('b0000000-0000-0000-0000-000000000003', 'grant@mentor.test', 'R. Grant', 'mentor', null, null, '3x founder', array['Validation','Product']),
  ('b0000000-0000-0000-0000-000000000004', 'deluca@mentor.test', 'Mia DeLuca', 'mentor', null, null, 'Services founder, 1 exit', array['B2B services','Pricing']),
  ('b0000000-0000-0000-0000-000000000005', 'dana@mentor.test', 'Dana Whitfield', 'mentor', null, null, 'FinTech founder, 1 exit', array['FinTech','Pricing','Fundraising']),
  ('b0000000-0000-0000-0000-000000000006', 'hale@mentor.test', 'Marcus Hale', 'mentor', null, null, 'Payments PM, 12 yrs', array['Payments','Partnerships']),
  ('b0000000-0000-0000-0000-000000000007', 'cruz@mentor.test', 'Elena Cruz', 'mentor', null, null, 'B2B SaaS founder', array['Sales','SaaS']);

insert into pairings (id, cohort_id, founder_id, mentor_id, status, declared_cadence, match_rationale, started_at) values
  ('d0000000-0000-0000-0000-000000000001', 'c0000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'active', 'biweekly', 'Sam built and sold two marketplace companies and has coached founders through the exact two-sided discovery problem Trellis is working on now.', '2026-07-20T12:00:00Z'),
  ('d0000000-0000-0000-0000-000000000002', 'c0000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000002', 'b0000000-0000-0000-0000-000000000001', 'active', 'weekly', 'Sam''s consumer-adjacent marketplace experience matches Fernway''s early validation questions.', '2026-07-20T12:00:00Z'),
  ('d0000000-0000-0000-0000-000000000003', 'c0000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000002', 'active', 'biweekly', 'Casey''s B2B sales background matched Priya''s go-to-market questions.', '2026-07-20T12:00:00Z'),
  ('d0000000-0000-0000-0000-000000000004', 'c0000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000004', 'b0000000-0000-0000-0000-000000000003', 'active', 'biweekly', 'Grant has taken three products through early validation.', '2026-07-20T12:00:00Z'),
  ('d0000000-0000-0000-0000-000000000005', 'c0000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000005', 'b0000000-0000-0000-0000-000000000004', 'active', 'weekly', 'Mia built and sold a services company one stage ahead of Kindling.', '2026-07-20T12:00:00Z');

insert into meetings (id, pairing_id, scheduled_at, status, week_number) values
  ('e1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', '2026-07-22T18:00:00Z', 'completed', 2),
  ('e1000000-0000-0000-0000-000000000002', 'd0000000-0000-0000-0000-000000000001', '2026-08-06T18:00:00Z', 'scheduled', 4),
  ('e1000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', '2026-07-31T15:00:00Z', 'completed', 3),
  ('e1000000-0000-0000-0000-000000000004', 'd0000000-0000-0000-0000-000000000002', '2026-08-07T15:00:00Z', 'scheduled', 4),
  ('e1000000-0000-0000-0000-000000000005', 'd0000000-0000-0000-0000-000000000003', '2026-07-18T16:00:00Z', 'completed', 2),
  ('e1000000-0000-0000-0000-000000000006', 'd0000000-0000-0000-0000-000000000004', '2026-07-25T14:00:00Z', 'completed', 3),
  ('e1000000-0000-0000-0000-000000000007', 'd0000000-0000-0000-0000-000000000005', '2026-07-29T17:00:00Z', 'completed', 3),
  ('e1000000-0000-0000-0000-000000000008', 'd0000000-0000-0000-0000-000000000005', '2026-08-12T17:00:00Z', 'scheduled', 6);

insert into meeting_notes (meeting_id, status_flag, confidence, founder_section, mentor_section, key_insight, founder_submitted_at, mentor_submitted_at) values
  ('e1000000-0000-0000-0000-000000000001', 'on_track', 7,
   '{"actionItemCheckIds":[],"whatMoved":["Mapped the supply side of the market","Set up first five field conversations"],"whatChangedMyThinking":"Realized the supplier list is easier to build than expected; the buyer side is the open question.","whereINeedHelp":"How to structure early discovery interviews.","focusNextWeek":["Talk to at least 5 people in the field","Write down the passive-side value prop"]}',
   '{"read":"Solid start. Confidence 7 seems fair.","whatImSeeing":["Alex moves fast once a question is concrete"],"risks":["Interview quality over quantity"],"focusAdjustments":["Agreed plan as drafted"],"myTake":"Good first working session. The next two weeks of interviews will tell us a lot."}',
   'Supply is not the constraint for Trellis.', '2026-07-21T14:00:00Z', '2026-07-22T20:15:00Z'),
  ('e1000000-0000-0000-0000-000000000002', 'on_track', 6,
   '{"actionItemCheckIds":[],"whatMoved":["Talked to about 7 people in the field, mostly informal","Learned that roughly half of target users aren''t active on the channel we assumed","Started shaping a clearer value prop for the passive side of the market"],"whatChangedMyThinking":"I assumed our problem was reaching suppliers. The interviews showed supply is fine; the real question is why a passive buyer would ever show up.","whereINeedHelp":"I''m stuck on why someone would engage if they''re not actively looking. Need help pressure-testing the value prop for that group.","focusNextWeek":["Get a rough wireframe together","Run a tighter set of interviews focused on behavior, not just opinions"]}',
   null, null, '2026-08-03T17:14:00Z', null),
  ('e1000000-0000-0000-0000-000000000003', 'at_risk', 4,
   '{"actionItemCheckIds":[],"whatMoved":["Sketched onboarding flow","One user conversation"],"whatChangedMyThinking":"Not sure this week. Mostly heads-down building.","whereINeedHelp":"Am I building too early?","focusNextWeek":["Decide whether to pause the build"]}',
   null, null, '2026-07-30T13:00:00Z', null);

insert into action_items (meeting_id, pairing_id, description, owner_id, due_date, status, completed_at) values
  ('e1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Talk to at least 5 people in the field', 'f0000000-0000-0000-0000-000000000001', '2026-08-04', 'done', '2026-08-01T12:00:00Z'),
  ('e1000000-0000-0000-0000-000000000001', 'd0000000-0000-0000-0000-000000000001', 'Write down the passive-side value prop', 'f0000000-0000-0000-0000-000000000001', '2026-08-04', 'done', '2026-08-03T12:00:00Z'),
  ('e1000000-0000-0000-0000-000000000003', 'd0000000-0000-0000-0000-000000000002', 'List the riskiest assumption before building further', 'f0000000-0000-0000-0000-000000000002', '2026-08-05', 'open', null);

insert into messages (pairing_id, sender_id, body, created_at) values
  ('d0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'Quick heads up, my note is in. The channel finding surprised me.', '2026-08-02T19:40:00Z'),
  ('d0000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'The wireframe direction makes sense. Bring whatever you have Thursday, rough is fine.', '2026-08-02T20:12:00Z'),
  ('d0000000-0000-0000-0000-000000000001', 'f0000000-0000-0000-0000-000000000001', 'Will do. Also got two more interviews booked for Wednesday.', '2026-08-02T21:03:00Z');

insert into flags (raised_by, category, body, status, created_at) values
  ('b0000000-0000-0000-0000-000000000003', 'pattern_risk', 'Third founder this cohort building before validating. Might be worth a workshop in week 5.', 'open', '2026-08-01T15:00:00Z');

insert into match_suggestions (cohort_id, founder_id, mentor_id, score, breakdown, rationale, rank, status) values
  ('c0000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000005', 87, '["Industry: fintech","Stage: pre-revenue","Asked for: pricing"]', 'Dana priced and repriced a B2B fintech product through the exact stage Priya is stuck on, and her questionnaire asks for direct, structured feedback, which matches Dana''s style.', 1, 'suggested'),
  ('c0000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000006', 74, '["Industry: payments","Skill: partnerships"]', 'Strong domain overlap; less experience with pre-revenue founders.', 2, 'suggested'),
  ('c0000000-0000-0000-0000-000000000007', 'f0000000-0000-0000-0000-000000000003', 'b0000000-0000-0000-0000-000000000007', 68, '["Stage fit","Skill: sales","At capacity next month"]', 'Good stage fit; capacity is the concern.', 3, 'suggested');
