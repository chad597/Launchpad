-- Launchpad Mentor App: the migrations your database is still missing.
--
-- Run this whole file in the Supabase SQL Editor. It is safe to run more than
-- once: every statement tolerates the object already existing, so if it fails
-- partway you can fix the cause and run it again.
--
-- Part 1 creates the intake form tables and the mentor fields (migration 0004,
-- which was never applied). Part 2 applies the security fixes and removes the
-- instructor role (migration 0005).

-- ============================================================
-- PART 1 of 2: intake forms and mentor fields
-- ============================================================

-- Editable intake forms and the potential-mentor pipeline.
--
-- Questions are rows, answers are jsonb keyed by question key. Admin screens
-- and the CSV export render one column per question from these definitions,
-- so adding a question adds a column everywhere it matters. We deliberately
-- do not run ALTER TABLE per question: that would mean generating DDL from
-- admin input, which bypasses row-level security on the new column and makes
-- the schema impossible to migrate.

do $$ begin
  create type question_type as enum (
    'short_text','long_text','email','phone','url',
    'dropdown','multi_select','ranked_select','statement','consent'
  );
exception when duplicate_object then null;
end $$;

create table if not exists form_definitions (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  intro_title text,
  intro_body text,
  intro_note text,
  closing_title text,
  closing_body text,
  updated_at timestamptz not null default now()
);

create table if not exists form_questions (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references form_definitions (id) on delete cascade,
  key text not null,
  section text not null default 'General',
  position int not null default 0,
  type question_type not null default 'short_text',
  label text not null,
  help text,
  body text,
  options jsonb not null default '[]',
  required boolean not null default false,
  max_select int,
  archived boolean not null default false,
  created_at timestamptz not null default now(),
  unique (form_id, key)
);

create index if not exists form_questions_form_idx on form_questions (form_id, position);

-- Applicants. Name, email, and phone are copied out of the answers so the
-- list view and duplicate checks do not have to read jsonb.
create table if not exists mentor_applications (
  id uuid primary key default gen_random_uuid(),
  form_id uuid references form_definitions (id),
  name text,
  email text,
  phone text,
  answers jsonb not null default '{}',
  status text not null default 'new',           -- new / reviewing / accepted / declined
  review_note text,
  reviewed_by uuid references users (id),
  reviewed_at timestamptz,
  invited_user_id uuid references users (id),
  submitted_at timestamptz not null default now()
);

create index if not exists mentor_applications_status_idx on mentor_applications (status, submitted_at desc);
create index if not exists mentor_applications_email_idx on mentor_applications (lower(email));

alter table form_definitions enable row level security;
alter table form_questions enable row level security;
alter table mentor_applications enable row level security;

-- The application form is public, so anyone can read its definition and
-- submit once. Nobody but an admin can read what was submitted.
drop policy if exists forms_public_read on form_definitions;
create policy forms_public_read on form_definitions for select using (true);
drop policy if exists questions_public_read on form_questions;
create policy questions_public_read on form_questions for select using (true);
drop policy if exists forms_admin_write on form_definitions;
create policy forms_admin_write on form_definitions for all using (current_app_role() = 'admin');
drop policy if exists questions_admin_write on form_questions;
create policy questions_admin_write on form_questions for all using (current_app_role() = 'admin');

drop policy if exists applications_public_insert on mentor_applications;
create policy applications_public_insert on mentor_applications for insert with check (true);
drop policy if exists applications_staff_read on mentor_applications;
create policy applications_staff_read on mentor_applications for select
  using (current_app_role() = 'admin');
drop policy if exists applications_admin_write on mentor_applications;
create policy applications_admin_write on mentor_applications for update
  using (current_app_role() = 'admin');

-- ===== Seed: the mentor application as specced =====

insert into form_definitions (id, slug, name, intro_title, intro_body, intro_note, closing_title, closing_body)
values (
  '11110000-0000-0000-0000-000000000001',
  'mentor-application',
  'Mentor application',
  'Mentor a Launchpad founder.',
  'Our founders are at the idea stage, working on something you have probably already lived through. Tell us what you have done and how you want to be involved, and we will handle the matching.',
  'Takes about 3 minutes.',
  'Thanks, that is everything we need.',
  E'Chad reads every one of these personally. You will hear from him within a week, either way. If it is a fit, the next step is a short profile so we can match you well.\n\nIn the meantime we will send you an invite to the Launchpad community, where you can see what our founders are working on and answer a question whenever you have a few minutes.'
)
on conflict (id) do nothing;

insert into form_questions (form_id, key, section, position, type, label, help, body, options, required, max_select) values
('11110000-0000-0000-0000-000000000001','first_name','About you',10,'short_text','First name',null,null,'[]',true,null),
('11110000-0000-0000-0000-000000000001','last_name','About you',20,'short_text','Last name',null,null,'[]',true,null),
('11110000-0000-0000-0000-000000000001','email','About you',30,'email','Email','This is the address you will sign in with, so use the one you check.',null,'[]',true,null),
('11110000-0000-0000-0000-000000000001','phone','About you',40,'phone','Phone',null,null,'[]',true,null),
('11110000-0000-0000-0000-000000000001','company','About you',50,'short_text','Company',null,null,'[]',false,null),
('11110000-0000-0000-0000-000000000001','title','About you',60,'short_text','Title',null,null,'[]',false,null),
('11110000-0000-0000-0000-000000000001','linkedin','About you',70,'url','LinkedIn URL',null,null,'[]',true,null),
('11110000-0000-0000-0000-000000000001','time_zone','About you',80,'dropdown','Time zone',null,null,
 '[{"value":"eastern","label":"Eastern"},{"value":"central","label":"Central"},{"value":"mountain","label":"Mountain"},{"value":"pacific","label":"Pacific"},{"value":"other","label":"Other"}]',true,null),
('11110000-0000-0000-0000-000000000001','years_experience','About you',90,'dropdown','How long have you been working in technology or startups?',null,null,
 '[{"value":"under_5","label":"Under 5 years"},{"value":"5_10","label":"5 to 10 years"},{"value":"10_20","label":"10 to 20 years"},{"value":"20_plus","label":"20+ years"}]',true,null),

('11110000-0000-0000-0000-000000000001','expectations','What we look for',100,'statement','What we look for, and what we ask',null,
 E'Our founders are at the idea stage. Most of them are working on something you have already lived through.\n\n**What we look for**\n\nYou have built or run something. That might be a company you founded, a business you owned, or a unit whose numbers you were responsible for. You have watched a plan not survive contact with real customers, and you can talk about that as easily as you talk about the wins. You give advice people can act on, grounded in what actually happened to you.\n\nYou do not need to have exited a company, raised venture money, or worked in tech. Some of our most useful mentors ran businesses that never took a dollar of outside investment.\n\n**What we ask**\n\n- Show up when you commit.\n- Listen before you give advice.\n- Be honest, including when the honest answer is that you do not know.\n- Tell us early when something is not working. That is a favor to us, not a complaint.\n\n**What this is not**\n\nMentoring is not a channel for selling services, sourcing deals, or recruiting. If you and a founder later decide you want to work together commercially, that conversation happens outside the program, and after it.',
 '[]',false,null),

('11110000-0000-0000-0000-000000000001','background','Your experience',110,'multi_select','Which of these describe you?','Select all that apply.',null,
 '[{"value":"founded","label":"Founded or co-founded a company"},{"value":"exited","label":"Exited a company through a sale, acquisition, or IPO"},{"value":"pnl","label":"Ran a P&L or a business unit"},{"value":"operator","label":"Early employee or senior operator at a startup"},{"value":"sme","label":"Deep expertise in one area, without founding a company"}]',true,null),
('11110000-0000-0000-0000-000000000001','industries','Your experience',120,'multi_select','Where have you actually operated?','Select all that apply.',null,
 '[{"value":"software","label":"Software"},{"value":"hardware_iot","label":"Hardware and IoT"},{"value":"ai_ml","label":"AI and ML"},{"value":"fintech","label":"Fintech"},{"value":"healthtech","label":"Healthtech"},{"value":"edtech","label":"Edtech"},{"value":"ecommerce","label":"E-commerce"},{"value":"consumer","label":"Consumer"},{"value":"b2b_services","label":"B2B services"},{"value":"manufacturing","label":"Manufacturing"},{"value":"sportstech","label":"Sportstech"},{"value":"cybersecurity","label":"Cybersecurity"},{"value":"other","label":"Other"}]',true,null),
('11110000-0000-0000-0000-000000000001','skills','Your experience',130,'ranked_select','What can you help a founder do?','Choose up to three, strongest first. We weight your first answer most heavily when matching.',null,
 '[{"value":"first_customers","label":"Finding first customers"},{"value":"building_product","label":"Building the product"},{"value":"pricing","label":"Pricing"},{"value":"raising_money","label":"Raising money"},{"value":"hiring","label":"Hiring and managing people"},{"value":"business_setup","label":"Setting up the business (legal, finance, admin)"},{"value":"selling_b2b","label":"Selling into companies"},{"value":"marketing_growth","label":"Marketing and growth"},{"value":"strategy","label":"Strategy and focus"},{"value":"other","label":"Something else"}]',true,3),
('11110000-0000-0000-0000-000000000001','story','Your experience',140,'long_text','Tell us about a problem you have solved that a first-time founder is likely to hit.','Two or three sentences. Specific beats impressive. Your founder will read this when we introduce you.',null,'[]',true,null),

('11110000-0000-0000-0000-000000000001','tracks','How you want to be involved',150,'multi_select','How do you want to be involved?','Select all that apply.',null,
 '[{"value":"ask_a_mentor","label":"Answer questions online","description":"Founders post questions by topic and you jump in when something is in your lane. No schedule, no commitment."},{"value":"office_hours","label":"Hold office hours","description":"You open a two-hour window and founders book 30-minute slots. Usually once or twice a cohort."},{"value":"one_to_one","label":"Take on one founder for 12 weeks","description":"A working relationship with a single founder, roughly 30 to 60 minutes every couple of weeks. This is the deep end."}]',true,null),

('11110000-0000-0000-0000-000000000001','ground_rules','Ground rules',160,'consent','Understood, I am in',null,
 E'Two things we ask of everyone. You are volunteering your experience, not selling your services. And what a founder tells you stays with you.\n\nThese are the short version of our Mentor Code of Conduct.','[]',true,null),
('11110000-0000-0000-0000-000000000001','referral','Ground rules',170,'short_text','How did you hear about Launchpad?',null,null,'[]',false,null)
on conflict (form_id, key) do nothing;

-- ===== Mentor record: the fields matching actually reads =====

alter table users add column if not exists phone text;
alter table users add column if not exists title text;
alter table users add column if not exists linkedin text;
alter table users add column if not exists time_zone text;
alter table users add column if not exists years_experience text;
alter table users add column if not exists background text[];
alter table users add column if not exists industries text[];
alter table users add column if not exists skills jsonb default '[]';        -- ranked, strongest first
alter table users add column if not exists avoid_skills text[];
alter table users add column if not exists story text;
alter table users add column if not exists tracks text[];
alter table users add column if not exists mentoring_format text;
alter table users add column if not exists stage_preference text;
alter table users add column if not exists conflicts text;
alter table users add column if not exists mentor_motivation text;
alter table users add column if not exists referral_source text;
alter table users add column if not exists profile_answers jsonb default '{}';
alter table users add column if not exists profile_completed_at timestamptz;

-- ===== Seed: the profile form accepted mentors complete at first sign-in =====

insert into form_definitions (id, slug, name, intro_title, intro_body, intro_note, closing_title, closing_body)
values (
  '11110000-0000-0000-0000-000000000002',
  'mentor-profile',
  'Mentor profile',
  'You are in. Let''s set up your profile.',
  'This is what founders see when we introduce you, and it is what we use to make the match. Three minutes, and you can change any of it later.',
  null,
  'Your profile is set.',
  'We will be in touch when we have a founder who fits. In the meantime your profile is live and you can update it any time from your dashboard.'
)
on conflict (id) do nothing;

insert into form_questions (form_id, key, section, position, type, label, help, body, options, required, max_select) values
('11110000-0000-0000-0000-000000000002','bio','Your profile',10,'short_text','How would you describe yourself to a founder, in one line?','For example: "Co-founder and CEO at Northwind, previously ran ops at a payments company."',null,'[]',true,null),

('11110000-0000-0000-0000-000000000002','avoid_skills','Fit',20,'multi_select','Anything you would rather not be the go-to for?','Select any. We ask because a founder''s biggest problem should not land with someone who is lukewarm about it. This has no bearing on your place in the program, and you can change it any time.',null,
 '[{"value":"first_customers","label":"Finding first customers"},{"value":"building_product","label":"Building the product"},{"value":"pricing","label":"Pricing"},{"value":"raising_money","label":"Raising money"},{"value":"hiring","label":"Hiring and managing people"},{"value":"business_setup","label":"Setting up the business (legal, finance, admin)"},{"value":"selling_b2b","label":"Selling into companies"},{"value":"marketing_growth","label":"Marketing and growth"},{"value":"strategy","label":"Strategy and focus"},{"value":"other","label":"Something else"}]',false,null),

('11110000-0000-0000-0000-000000000002','mentoring_format','Fit',30,'dropdown','Preferred mentoring format',null,null,
 '[{"value":"hands_on","label":"Hands-on","description":"I like to get into the work with them."},{"value":"advisory","label":"Advisory","description":"They bring what they are wrestling with and I pressure-test it."},{"value":"coaching","label":"Coaching","description":"I mostly ask questions and let them find the answer."},{"value":"structured","label":"Structured","description":"I like clear goals and checking progress against them."},{"value":"depends","label":"Depends on the founder"}]',true,null),

('11110000-0000-0000-0000-000000000002','stage_preference','Fit',40,'dropdown','Our founders are mostly pre-product or pre-revenue. Where are you most useful?',null,null,
 '[{"value":"idea","label":"Idea and pre-product"},{"value":"first_customers","label":"Just got their first customers"},{"value":"both","label":"Both"},{"value":"no_preference","label":"No preference"}]',true,null),

('11110000-0000-0000-0000-000000000002','capacity','Commitment',50,'dropdown','How many founders can you take at once?','Only relevant if you are taking on a founder for 12 weeks. You can set this to zero later to pause without leaving the pool.',null,
 '[{"value":"1","label":"One"},{"value":"2","label":"Two"},{"value":"3","label":"Three or more"}]',false,null),

('11110000-0000-0000-0000-000000000002','availability','Commitment',60,'short_text','When are you usually free?','Rough is fine. For example: "Tuesday and Thursday afternoons."',null,'[]',true,null),

('11110000-0000-0000-0000-000000000002','conflicts','Commitment',70,'long_text','Anything we should know before we match you?','A competing business, an investment interest, or an existing relationship with someone in the program. Optional, and disclosing something rarely changes anything. It just lets us make the call together.',null,'[]',false,null),

('11110000-0000-0000-0000-000000000002','mentor_motivation','Commitment',80,'long_text','What would make this worth your time?','Optional. Staying close to early-stage work, meeting other operators, something else entirely.',null,'[]',false,null)
on conflict (form_id, key) do nothing;


-- ============================================================
-- PART 2 of 2: security fixes and instructor removal
-- ============================================================

-- Security fixes found in the August 2026 QA pass, plus removal of the
-- instructor role. Every item here is a production-only issue: demo mode
-- never exercises row-level security.

-- ===== 0. Remove the instructor role =====
-- Instructors were never asked for and should have no access to the app.
-- 0001 granted them read access to pairings, meetings, notes, action items,
-- flags, questionnaire responses and the mentor pool. All of it is revoked
-- here, and the seeded instructor account is removed.

drop policy if exists pool_read on cohort_mentor_pool;
create policy pool_read on cohort_mentor_pool for select
  using (current_app_role() = 'admin');

drop policy if exists qr_own on questionnaire_responses;
create policy qr_own on questionnaire_responses for select
  using (user_id = current_app_user() or current_app_role() = 'admin');

drop policy if exists pairings_read on pairings;
create policy pairings_read on pairings for select
  using (founder_id = current_app_user() or mentor_id = current_app_user()
         or current_app_role() = 'admin');

drop policy if exists meetings_read on meetings;
create policy meetings_read on meetings for select
  using (in_pairing(pairing_id) or current_app_role() = 'admin');

drop policy if exists items_read on action_items;
create policy items_read on action_items for select
  using (in_pairing(pairing_id) or current_app_role() = 'admin');

drop policy if exists flags_own on flags;
create policy flags_own on flags for select
  using (raised_by = current_app_user() or current_app_role() = 'admin');

drop policy if exists audit_staff_read on audit_log;
drop policy if exists audit_admin_read on audit_log;
create policy audit_admin_read on audit_log for select
  using (current_app_role() = 'admin');

drop policy if exists applications_staff_read on mentor_applications;
drop policy if exists applications_admin_read on mentor_applications;
create policy applications_admin_read on mentor_applications for select
  using (current_app_role() = 'admin');

-- Anyone already carrying the role loses it. Nothing in the app creates
-- instructors any more, so this is the seeded demo account.
delete from users where role = 'instructor';

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

drop trigger if exists users_guard_self_update on users;
create trigger users_guard_self_update
  before update on users
  for each row execute function guard_self_update();

drop policy if exists users_self_update on users;
create policy users_self_update on users for update
  using (auth_user_id = auth.uid())
  with check (auth_user_id = auth.uid());

-- ===== 2. Everyone could read everyone =====
-- The original policy exposed every column to every session, and 0004 then
-- added phone, linkedin, story, conflicts, mentor_motivation and
-- profile_answers to that same table. Conflicts in particular are solicited
-- as a confidential disclosure. Narrow reads to people you actually work with.

drop policy if exists users_read on users;

drop policy if exists users_read_self on users;
create policy users_read_self on users for select
  using (auth_user_id = auth.uid());

drop policy if exists users_read_staff on users;
create policy users_read_staff on users for select
  using (current_app_role() = 'admin');

-- Your counterpart in an active pairing, so names and profiles still render.
drop policy if exists users_read_counterpart on users;
create policy users_read_counterpart on users for select
  using (exists (
    select 1 from pairings p
    where p.status = 'active'
      and ((p.founder_id = users.id and p.mentor_id = current_app_user())
        or (p.mentor_id = users.id and p.founder_id = current_app_user()))
  ));

-- Mentors in this cohort's 1:1 pool are visible to that cohort's founders,
-- which is what the matching and profile screens need.
drop policy if exists users_read_pool on users;
create policy users_read_pool on users for select
  using (exists (
    select 1 from cohort_mentor_pool cp
    join cohort_members cm on cm.cohort_id = cp.cohort_id
    where cp.mentor_id = users.id and cm.user_id = current_app_user()
  ));

-- ===== 3. Writes the app makes that RLS silently rejected =====
-- cohort_members had only a SELECT policy, so importing founders into a cohort
-- appeared to succeed and did nothing.

drop policy if exists members_staff_write on cohort_members;
create policy members_staff_write on cohort_members for all
  using (current_app_role() = 'admin')
  with check (current_app_role() = 'admin');

-- Every email send inserts a notifications row; there was no insert policy,
-- so the entire send log was being discarded.
drop policy if exists notifications_insert on notifications;
create policy notifications_insert on notifications for insert
  with check (auth.uid() is not null);
drop policy if exists notifications_staff_read on notifications;
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

-- ===== 6. Meeting notes are pair-private =====
-- The app previously let any signed-in user read any pair's note; the policy
-- here matches the fixed application check.
drop policy if exists notes_read on meeting_notes;
create policy notes_read on meeting_notes for select
  using (
    exists (select 1 from meetings m where m.id = meeting_id and in_pairing(m.pairing_id))
    or current_app_role() = 'admin'
  );

