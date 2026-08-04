-- Editable intake forms and the potential-mentor pipeline.
--
-- Questions are rows, answers are jsonb keyed by question key. Admin screens
-- and the CSV export render one column per question from these definitions,
-- so adding a question adds a column everywhere it matters. We deliberately
-- do not run ALTER TABLE per question: that would mean generating DDL from
-- admin input, which bypasses row-level security on the new column and makes
-- the schema impossible to migrate.

create type question_type as enum (
  'short_text','long_text','email','phone','url',
  'dropdown','multi_select','ranked_select','statement','consent'
);

create table form_definitions (
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

create table form_questions (
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

create index form_questions_form_idx on form_questions (form_id, position);

-- Applicants. Name, email, and phone are copied out of the answers so the
-- list view and duplicate checks do not have to read jsonb.
create table mentor_applications (
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

create index mentor_applications_status_idx on mentor_applications (status, submitted_at desc);
create index mentor_applications_email_idx on mentor_applications (lower(email));

alter table form_definitions enable row level security;
alter table form_questions enable row level security;
alter table mentor_applications enable row level security;

-- The application form is public, so anyone can read its definition and
-- submit once. Nobody but an admin can read what was submitted.
create policy forms_public_read on form_definitions for select using (true);
create policy questions_public_read on form_questions for select using (true);
create policy forms_admin_write on form_definitions for all using (current_app_role() = 'admin');
create policy questions_admin_write on form_questions for all using (current_app_role() = 'admin');

create policy applications_public_insert on mentor_applications for insert with check (true);
create policy applications_staff_read on mentor_applications for select
  using (current_app_role() in ('admin','instructor'));
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
);

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
('11110000-0000-0000-0000-000000000001','referral','Ground rules',170,'short_text','How did you hear about Launchpad?',null,null,'[]',false,null);

-- ===== Mentor record: the fields matching actually reads =====

alter table users add column phone text;
alter table users add column title text;
alter table users add column linkedin text;
alter table users add column time_zone text;
alter table users add column years_experience text;
alter table users add column background text[];
alter table users add column industries text[];
alter table users add column skills jsonb default '[]';        -- ranked, strongest first
alter table users add column avoid_skills text[];
alter table users add column story text;
alter table users add column tracks text[];
alter table users add column mentoring_format text;
alter table users add column stage_preference text;
alter table users add column conflicts text;
alter table users add column mentor_motivation text;
alter table users add column referral_source text;
alter table users add column profile_answers jsonb default '{}';
alter table users add column profile_completed_at timestamptz;

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
);

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

('11110000-0000-0000-0000-000000000002','mentor_motivation','Commitment',80,'long_text','What would make this worth your time?','Optional. Staying close to early-stage work, meeting other operators, something else entirely.',null,'[]',false,null);
