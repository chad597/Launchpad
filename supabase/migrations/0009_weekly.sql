-- The weekly founder update.
--
-- Replaces a twenty-one question form that mostly asked for things the
-- program already held, and which founders therefore stopped filling in. The
-- new one asks eleven, nine of them one click, and every answer either draws
-- a line over the twelve weeks or puts something in front of staff to act on.
--
-- The numbers get their own columns because they are read as a series: this
-- week against last week, and one founder against the cohort. The whole
-- answer set still lands in `answers`, so a question an admin adds at
-- /admin/forms is stored and rendered without a migration, the same as every
-- other form in the app.

-- ===== Question types stop being an enum =====
-- The weekly form needs a number field, and adding a value to a Postgres enum
-- cannot be used in the same transaction that adds it. A checked text column
-- takes new question types without this dance, which matters for a form
-- builder that will keep gaining them.
-- The default has to go first: it is itself a reference to the enum, and the
-- type cannot be dropped while it stands.
alter table form_questions alter column type drop default;
alter table form_questions alter column type type text using type::text;
alter table form_questions alter column type set default 'short_text';
alter table form_questions add constraint form_questions_type_check check (
  type in (
    'short_text','long_text','email','phone','url','number',
    'dropdown','multi_select','ranked_select','statement','consent'
  )
);
drop type if exists question_type;

-- ===== Weekly updates =====
create table if not exists weekly_updates (
  id uuid primary key default gen_random_uuid(),
  founder_id uuid not null references users (id) on delete cascade,
  cohort_id uuid references cohorts (id),
  -- The Monday the week started, in Eastern time. One row per founder per
  -- week, and re-filing the same week updates the row rather than adding one.
  week_start date not null,
  week_number int,

  -- Bands, not numbers, because a founder can answer them honestly in one
  -- click. Ranked in lib/weekly-form.ts so a trend can tell up from down.
  hours text,
  conversations text,
  runway text,

  shipped text,
  users_count int,
  paying_count int,
  -- Cents, so no rounding argument ever reaches a report.
  revenue_cents int,
  confidence int check (confidence is null or (confidence between 1 and 10)),
  blocker text,
  ask text,

  answers jsonb not null default '{}',
  submitted_at timestamptz not null default now(),
  updated_at timestamptz,
  unique (founder_id, week_start)
);

create index if not exists weekly_updates_founder_idx on weekly_updates (founder_id, week_start desc);
create index if not exists weekly_updates_week_idx on weekly_updates (cohort_id, week_start desc);

alter table weekly_updates enable row level security;

-- A mentor reads the weekly updates of the founders they are actively paired
-- with, and nobody else's.
create or replace function is_my_founder(f uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.pairings
    where founder_id = f and mentor_id = current_app_user() and status = 'active'
  )
$$;

create policy weekly_read on weekly_updates for select using (
  founder_id = current_app_user()
  or is_my_founder(founder_id)
  or current_app_role() = 'admin'
);
create policy weekly_insert on weekly_updates for insert with check (
  founder_id = current_app_user()
);
create policy weekly_update on weekly_updates for update using (
  founder_id = current_app_user()
);

-- ===== Seed: the weekly form =====
insert into form_definitions (id, slug, name, intro_title, intro_body, intro_note, closing_title, closing_body)
values (
  '11110000-0000-0000-0000-000000000005',
  'founder-weekly',
  'Founder weekly update',
  'How did this week go?',
  E'Eleven questions, and nine of them are one click. Last week''s answers are already in the boxes, so change what moved and leave the rest. Your mentor reads this before your next meeting, and it is what the Launchpad team looks at when we decide who needs help.',
  'Takes about two minutes.',
  'Filed.',
  'Your mentor can see it now. Come back any time this week to change an answer.'
) on conflict (slug) do nothing;

insert into form_questions (form_id, key, section, position, type, label, help, body, options, required, max_select) values
('11110000-0000-0000-0000-000000000005','hours','This week',10,'dropdown','How much time did you put into it?','Count the hours you actually worked on it. A light week is worth recording, and nobody is graded on this.',null,'[{"value":"none","label":"None this week"},{"value":"under_5","label":"Under 5 hours"},{"value":"5_15","label":"5 to 15 hours"},{"value":"15_30","label":"15 to 30 hours"},{"value":"full","label":"Full time on it"}]',true,null),
('11110000-0000-0000-0000-000000000005','conversations','This week',20,'dropdown','How many people outside your team did you talk to about it?','Customers, users, anyone in the industry. People who could tell you that you are wrong.',null,'[{"value":"0","label":"None"},{"value":"1_2","label":"One or two"},{"value":"3_5","label":"Three to five"},{"value":"6_10","label":"Six to ten"},{"value":"10_plus","label":"More than ten"}]',true,null),
('11110000-0000-0000-0000-000000000005','shipped','This week',30,'short_text','What is the one thing you finished?','One line. Something that exists now and did not exist last Monday. A week with nothing in it can say so.',null,'[]',true,null),
('11110000-0000-0000-0000-000000000005','users_count','The numbers',40,'number','People using it right now','Leave it empty if there is nothing to use yet. Count people who came back, rather than everyone who ever signed up.',null,'[]',false,null),
('11110000-0000-0000-0000-000000000005','paying_count','The numbers',50,'number','Paying customers',null,null,'[]',false,null),
('11110000-0000-0000-0000-000000000005','revenue','The numbers',60,'number','Money you collected this week, in dollars','What actually landed in the account between Monday and today. Zero is an answer, and it is the answer most weeks.',null,'[]',false,null),
('11110000-0000-0000-0000-000000000005','runway','The numbers',70,'dropdown','How long can you keep going at what you are spending now?','Your own runway counts. Most founders here are funding this out of savings or a salary.',null,'[{"value":"not_spending","label":"I am not spending money on it yet"},{"value":"under_3","label":"Under 3 months"},{"value":"3_6","label":"3 to 6 months"},{"value":"6_12","label":"6 to 12 months"},{"value":"over_12","label":"More than a year"}]',true,null),
('11110000-0000-0000-0000-000000000005','confidence','Where you need help',80,'dropdown','How confident are you this week that this is going to work?','1 to 10. The same scale as your meeting note, so the two sit on one line over the twelve weeks.',null,'[{"value":"1","label":"1"},{"value":"2","label":"2"},{"value":"3","label":"3"},{"value":"4","label":"4"},{"value":"5","label":"5"},{"value":"6","label":"6"},{"value":"7","label":"7"},{"value":"8","label":"8"},{"value":"9","label":"9"},{"value":"10","label":"10"}]',true,null),
('11110000-0000-0000-0000-000000000005','blocker','Where you need help',90,'long_text','What is in your way right now?','One or two sentences. This is the question your mentor reads first, so write the real one.',null,'[]',true,null),
('11110000-0000-0000-0000-000000000005','ask','Where you need help',100,'short_text','One thing Launchpad could do this week that would actually help','Optional. An introduction, someone to talk to who has done this before, a customer, a room. We cannot promise it, but we cannot do it if we do not know.',null,'[]',false,null),
('11110000-0000-0000-0000-000000000005','needs_changed','Where you need help',110,'ranked_select','Has what you need help with changed?','Optional, and most weeks it has not. Fill this in only if your top three have moved, and we will update what your mentor sees and what we match on.',null,'[{"value":"first_customers","label":"Finding first customers"},{"value":"building_product","label":"Building the product"},{"value":"pricing","label":"Pricing"},{"value":"raising_money","label":"Raising money"},{"value":"hiring","label":"Hiring and managing people"},{"value":"business_setup","label":"Setting up the business (legal, finance, admin)"},{"value":"selling_b2b","label":"Selling into companies"},{"value":"marketing_growth","label":"Marketing and growth"},{"value":"strategy","label":"Strategy and focus"},{"value":"other","label":"Something else"}]',false,3)
on conflict (form_id, key) do nothing;

insert into public.applied_migrations (filename) values ('0009_weekly.sql')
  on conflict (filename) do nothing;
