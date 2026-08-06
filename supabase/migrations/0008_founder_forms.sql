-- The founder side of matching: two forms, and the columns they feed.
--
-- Until now a founder record held a name, a company, and a line of free text
-- an admin typed at import, while the mentor record held ranked skills,
-- industries, stage preference and format. Matching had a rich side and an
-- empty one. These two forms fill the empty side, and they answer in the same
-- vocabulary the mentor form uses so the two join:
--
--   founder-intake  filled at first sign-in. Everything matching reads.
--   founder-brief   filled once a pairing exists, before the first meeting.
--                   Read by the mentor, not by the matcher, so it stays in
--                   jsonb and is rendered from the form definition.
--
-- The columns below duplicate answers that matching reads. The full answer
-- set also lives in profile_answers, the same way the mentor profile works.

alter table users add column if not exists website text;
alter table users add column if not exists founder_stage text;      -- idea / building / first_customers / revenue
alter table users add column if not exists team_shape text;         -- solo / cofounders / team
alter table users add column if not exists time_commitment text;    -- full_time / part_time / nights
alter table users add column if not exists needs jsonb default '[]';        -- ranked, most pressing first
alter table users add column if not exists strengths text[];        -- what the founder already has covered
alter table users add column if not exists challenge text;
alter table users add column if not exists goal text;
alter table users add column if not exists industry_pref text;      -- a_lot / somewhat / not_much
alter table users add column if not exists brief_answers jsonb default '{}';
alter table users add column if not exists brief_completed_at timestamptz;

-- Matching reads needs against skills, and industries against industries, for
-- every mentor in the pool. Both sides are arrays, so index the founder side.
create index if not exists users_founder_stage_idx on users (founder_stage) where founder_stage is not null;

-- ===== Seed: the two founder forms =====

insert into form_definitions (id, slug, name, intro_title, intro_body, intro_note, closing_title, closing_body)
values (
  '11110000-0000-0000-0000-000000000003',
  'founder-intake',
  'Founder intake',
  'Welcome to Launchpad mentorship.',
  'We match you with a mentor who has already solved the problem in front of you. Tell us what you are building and where you need help, and we will handle the rest. Your mentor reads your answers when we introduce you.',
  'Takes about five minutes.',
  'That is everything we need.',
  'Chad matches every founder by hand, and you meet your mentor in week 3. You can change any of these answers from your home screen.'
) on conflict (slug) do nothing;

insert into form_questions (form_id, key, section, position, type, label, help, body, options, required, max_select) values
('11110000-0000-0000-0000-000000000003','phone','About you',10,'phone','Phone','Your mentor gets this when we introduce you, so use the number you answer.',null,'[]',true,null),
('11110000-0000-0000-0000-000000000003','company','About you',20,'short_text','What is your company or project called?','A working name is fine.',null,'[]',true,null),
('11110000-0000-0000-0000-000000000003','website','About you',30,'url','Website or link','A site, a landing page, a demo. Leave it empty if there is nothing to show yet.',null,'[]',false,null),
('11110000-0000-0000-0000-000000000003','linkedin','About you',40,'url','LinkedIn URL',null,null,'[]',false,null),
('11110000-0000-0000-0000-000000000003','time_zone','About you',50,'dropdown','Time zone',null,null,'[{"value":"eastern","label":"Eastern"},{"value":"central","label":"Central"},{"value":"mountain","label":"Mountain"},{"value":"pacific","label":"Pacific"},{"value":"other","label":"Other"}]',true,null),
('11110000-0000-0000-0000-000000000003','availability','About you',60,'short_text','When are you usually free to meet?','Rough is fine. For example: "Tuesday and Thursday afternoons." We show it to your mentor when either of you books a meeting.',null,'[]',true,null),
('11110000-0000-0000-0000-000000000003','one_liner','What you are building',70,'short_text','What are you building, in one sentence?','Plain language beats a pitch. Your mentor sees this first.',null,'[]',true,null),
('11110000-0000-0000-0000-000000000003','industry','What you are building',80,'dropdown','Which of these is closest to what you are building?','Pick the nearest one. We use it to find mentors who have operated in the same world.',null,'[{"value":"software","label":"Software"},{"value":"hardware_iot","label":"Hardware and IoT"},{"value":"ai_ml","label":"AI and ML"},{"value":"fintech","label":"Fintech"},{"value":"healthtech","label":"Healthtech"},{"value":"edtech","label":"Edtech"},{"value":"ecommerce","label":"E-commerce"},{"value":"consumer","label":"Consumer"},{"value":"b2b_services","label":"B2B services"},{"value":"manufacturing","label":"Manufacturing"},{"value":"sportstech","label":"Sportstech"},{"value":"cybersecurity","label":"Cybersecurity"},{"value":"other","label":"Other"}]',true,null),
('11110000-0000-0000-0000-000000000003','stage','What you are building',90,'dropdown','Where are you today?',null,null,'[{"value":"idea","label":"An idea, nothing built yet"},{"value":"building","label":"Building it, not launched"},{"value":"first_customers","label":"Launched, working on first customers"},{"value":"revenue","label":"Paying customers, working on growth"}]',true,null),
('11110000-0000-0000-0000-000000000003','team','What you are building',100,'dropdown','Who is working on it?',null,null,'[{"value":"solo","label":"Just me"},{"value":"cofounders","label":"Me and a co-founder or two"},{"value":"team","label":"We have people on payroll"}]',true,null),
('11110000-0000-0000-0000-000000000003','commitment','What you are building',110,'dropdown','How much time do you give it?',null,null,'[{"value":"full_time","label":"Full time"},{"value":"part_time","label":"Part time, alongside a job"},{"value":"nights","label":"Evenings and weekends"}]',true,null),
('11110000-0000-0000-0000-000000000003','needs','What you need',120,'ranked_select','What do you most need help with?','Choose up to three, most pressing first. We weight your first answer most heavily, and we will not match you with a mentor who is lukewarm about it.',null,'[{"value":"first_customers","label":"Finding first customers"},{"value":"building_product","label":"Building the product"},{"value":"pricing","label":"Pricing"},{"value":"raising_money","label":"Raising money"},{"value":"hiring","label":"Hiring and managing people"},{"value":"business_setup","label":"Setting up the business (legal, finance, admin)"},{"value":"selling_b2b","label":"Selling into companies"},{"value":"marketing_growth","label":"Marketing and growth"},{"value":"strategy","label":"Strategy and focus"},{"value":"other","label":"Something else"}]',true,3),
('11110000-0000-0000-0000-000000000003','strengths','What you need',130,'multi_select','What do you already have covered?','Optional. Select anything you are genuinely strong at, so we do not spend your match on it.',null,'[{"value":"first_customers","label":"Finding first customers"},{"value":"building_product","label":"Building the product"},{"value":"pricing","label":"Pricing"},{"value":"raising_money","label":"Raising money"},{"value":"hiring","label":"Hiring and managing people"},{"value":"business_setup","label":"Setting up the business (legal, finance, admin)"},{"value":"selling_b2b","label":"Selling into companies"},{"value":"marketing_growth","label":"Marketing and growth"},{"value":"strategy","label":"Strategy and focus"},{"value":"other","label":"Something else"}]',false,null),
('11110000-0000-0000-0000-000000000003','biggest_challenge','What you need',140,'long_text','What is the hardest thing in front of you right now?','Two or three sentences. The more specific you are, the better we can match you.',null,'[]',true,null),
('11110000-0000-0000-0000-000000000003','win','What you need',150,'long_text','Twelve weeks from now, what would make this worth your time?','One or two things you want to be true that are not true today.',null,'[]',true,null),
('11110000-0000-0000-0000-000000000003','mentoring_format','How you like to work',160,'dropdown','How do you want your mentor to work with you?',null,null,'[{"value":"hands_on","label":"Hands-on","description":"Get into the work with me."},{"value":"advisory","label":"Advisory","description":"I bring what I am wrestling with and you pressure-test it."},{"value":"coaching","label":"Coaching","description":"Ask me questions and let me find the answer."},{"value":"structured","label":"Structured","description":"Set goals with me and hold me to them."},{"value":"depends","label":"I am not sure yet"}]',true,null),
('11110000-0000-0000-0000-000000000003','industry_pref','How you like to work',170,'dropdown','How much does it matter that your mentor has worked in your industry?',null,null,'[{"value":"a_lot","label":"A lot, I want someone from my world"},{"value":"somewhat","label":"Somewhat"},{"value":"not_much","label":"Not much, the problem matters more than the industry"}]',true,null),
('11110000-0000-0000-0000-000000000003','ground_rules','Before we match you',180,'consent','Understood, I am in',null,E'Three things we ask. Show up for the meetings you book. Fill in your half of the meeting note the day before, so your mentor walks in ready. Tell us early when something is not working, including when the match is wrong.\n\nYour mentor is volunteering their time. Treating it as valuable is the whole deal.','[]',true,null),
('11110000-0000-0000-0000-000000000003','anything_else','Before we match you',190,'long_text','Anything else your mentor should know before you meet?','Optional. Your mentor reads your answers, so if something is only for the Launchpad team, use the flag link on your home screen instead.',null,'[]',false,null)
on conflict (form_id, key) do nothing;

insert into form_definitions (id, slug, name, intro_title, intro_body, intro_note, closing_title, closing_body)
values (
  '11110000-0000-0000-0000-000000000004',
  'founder-brief',
  'Founder brief',
  'Brief your mentor.',
  'Your mentor reads this before your first meeting, so the time goes to the conversation instead of a recap. Write it the way you would explain it to someone who knows the industry. Ten minutes here buys back the first half of your first meeting.',
  'Takes about ten minutes.',
  'Sent.',
  'Your mentor can read it now. You can update it any time from your home screen.'
) on conflict (slug) do nothing;

insert into form_questions (form_id, key, section, position, type, label, help, body, options, required, max_select) values
('11110000-0000-0000-0000-000000000004','traction','Where things stand',10,'long_text','Where does it stand today?','Customers, users, revenue, a prototype, or an idea on paper. Real numbers if you have them, and say so plainly if you do not.',null,'[]',true,null),
('11110000-0000-0000-0000-000000000004','recent_progress','Where things stand',20,'long_text','What have you gotten done in the last three months?','Optional. It tells your mentor how fast you move.',null,'[]',false,null),
('11110000-0000-0000-0000-000000000004','tried','Where things stand',30,'long_text','What have you already tried on the problem you want help with?','It saves your mentor from suggesting the thing you ruled out months ago.',null,'[]',true,null),
('11110000-0000-0000-0000-000000000004','stuck','What you want from this',40,'long_text','What are you stuck on right now?',null,null,'[]',true,null),
('11110000-0000-0000-0000-000000000004','decision','What you want from this',50,'long_text','Is there a decision you are sitting on?','Optional. Something you keep turning over and have not called yet.',null,'[]',false,null),
('11110000-0000-0000-0000-000000000004','first_meeting','What you want from this',60,'long_text','What do you want to walk out of the first meeting with?',null,null,'[]',true,null),
('11110000-0000-0000-0000-000000000004','candor','How to be useful to you',70,'dropdown','When your mentor thinks you are wrong, how do you want to hear it?',null,null,'[{"value":"direct","label":"Say it straight"},{"value":"questions","label":"Ask me questions until I see it myself"},{"value":"gentle","label":"Land it gently, then be direct"}]',true,null),
('11110000-0000-0000-0000-000000000004','context','How to be useful to you',80,'long_text','Anything about you or your situation that helps them understand you?','Optional. A job you are leaving, a co-founder conversation you are dreading, a deadline nobody else knows about.',null,'[]',false,null),
('11110000-0000-0000-0000-000000000004','links','How to be useful to you',90,'long_text','Anything you want them to look at before you meet?','Optional. Paste links. A deck, a demo, a doc, a competitor you keep losing to.',null,'[]',false,null)
on conflict (form_id, key) do nothing;

insert into public.applied_migrations (filename) values ('0008_founder_forms.sql')
  on conflict (filename) do nothing;
