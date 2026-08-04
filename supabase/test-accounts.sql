-- Three test accounts for Chad, one per role, plus a live pairing between the
-- founder and mentor accounts so the whole meeting-note loop can be walked
-- from both sides. Paste into the Supabase SQL Editor and Run.
--
--   chad@launchpadtv.com   admin    (program staff view)
--   chad.hensel@gmail.com  founder  (was the seeded admin; demoted here)
--   chadhensel@gmail.com   mentor   (paired with the founder account)
--
-- Safe to re-run: every statement is idempotent.

-- 1. The admin account.
insert into users (email, name, role)
values ('chad@launchpadtv.com', 'Chad Hensel', 'admin')
on conflict (email) do update set role = 'admin';

-- 2. The founder account. This address was the seeded admin, so it changes role.
update users set
  role = 'founder',
  name = 'Chad Hensel (founder)',
  company = 'Northwind Labs',
  stage = 'Idea stage, B2B tooling'
where email = 'chad.hensel@gmail.com';

-- 3. The mentor account.
insert into users (email, name, role, bio, expertise, availability, capacity)
values (
  'chadhensel@gmail.com', 'Chad Hensel (mentor)', 'mentor',
  'Operator, three startups', array['Product', 'Go to market', 'Fundraising'],
  'Weekday afternoons', 2
)
on conflict (email) do update set
  role = 'mentor', bio = excluded.bio, expertise = excluded.expertise,
  availability = excluded.availability, capacity = excluded.capacity;

-- 4. Put both in the active cohort: founder as a member, mentor in the 1:1 pool.
insert into cohort_members (cohort_id, user_id)
select c.id, u.id
from cohorts c, users u
where c.status = 'active' and u.email = 'chad.hensel@gmail.com'
on conflict do nothing;

insert into cohort_mentor_pool (cohort_id, mentor_id, capacity)
select c.id, u.id, 2
from cohorts c, users u
where c.status = 'active' and u.email = 'chadhensel@gmail.com'
on conflict do nothing;

-- 5. Pair them.
insert into pairings (id, cohort_id, founder_id, mentor_id, status, declared_cadence, match_rationale, started_at)
select
  '0d000000-0000-0000-0000-000000000010',
  (select id from cohorts where status = 'active' order by start_date desc limit 1),
  (select id from users where email = 'chad.hensel@gmail.com'),
  (select id from users where email = 'chadhensel@gmail.com'),
  'active', 'biweekly',
  'Test pairing: the same person on both sides, so the full meeting-note loop can be walked without a second participant.',
  now()
on conflict (id) do nothing;

-- 6. A finished meeting, so the founder view has history and a confidence point.
insert into meetings (id, pairing_id, scheduled_at, status, week_number)
values ('0e000000-0000-0000-0000-000000000010', '0d000000-0000-0000-0000-000000000010',
        now() - interval '7 days', 'completed', 4)
on conflict (id) do nothing;

insert into meeting_notes (meeting_id, status_flag, confidence, founder_section, mentor_section, key_insight, decision_made, founder_submitted_at, mentor_submitted_at)
values (
  '0e000000-0000-0000-0000-000000000010', 'on_track', 5,
  '{"actionItemCheckIds":[],"whatMoved":["Wrote the first version of the positioning","Two customer calls"],"whatChangedMyThinking":"The people who said yes fastest were not the segment we planned for.","whereINeedHelp":"Whether to chase the segment that is actually pulling.","focusNextWeek":["Talk to five people in the segment that responded","Draft a one-page positioning test"]}',
  '{"read":"Reasonable read. A 5 is honest for this stage.","whatImSeeing":["The pull is real but narrow"],"risks":["Chasing a segment before the problem is confirmed"],"focusAdjustments":["Do the five calls before rewriting anything"],"myTake":"Good instinct to follow the pull. Confirm the problem before committing the positioning."}',
  'Follow the segment that is pulling, but confirm the problem first.',
  'Hold the rewrite until after the calls.',
  now() - interval '8 days', now() - interval '6 days'
) on conflict (meeting_id) do nothing;

-- Action items from that meeting: one done, one still open, so the next note
-- opens with a real checklist.
insert into action_items (meeting_id, pairing_id, description, owner_id, due_date, status, completed_at)
select '0e000000-0000-0000-0000-000000000010', '0d000000-0000-0000-0000-000000000010',
       'Talk to five people in the segment that responded',
       (select id from users where email = 'chad.hensel@gmail.com'),
       (current_date - 1), 'done', now() - interval '2 days'
where not exists (
  select 1 from action_items where meeting_id = '0e000000-0000-0000-0000-000000000010'
    and description = 'Talk to five people in the segment that responded');

insert into action_items (meeting_id, pairing_id, description, owner_id, due_date, status)
select '0e000000-0000-0000-0000-000000000010', '0d000000-0000-0000-0000-000000000010',
       'Draft a one-page positioning test',
       (select id from users where email = 'chad.hensel@gmail.com'),
       (current_date + 2), 'open'
where not exists (
  select 1 from action_items where meeting_id = '0e000000-0000-0000-0000-000000000010'
    and description = 'Draft a one-page positioning test');

-- Intro to a mentor-owned action item, so both sides show up in the list.
insert into action_items (meeting_id, pairing_id, description, owner_id, due_date, status)
select '0e000000-0000-0000-0000-000000000010', '0d000000-0000-0000-0000-000000000010',
       'Intro to someone who sells into that segment',
       (select id from users where email = 'chadhensel@gmail.com'),
       (current_date + 3), 'open'
where not exists (
  select 1 from action_items where meeting_id = '0e000000-0000-0000-0000-000000000010'
    and description = 'Intro to someone who sells into that segment');

-- 7. An upcoming meeting with NO note yet: this is the one to practice on.
insert into meetings (id, pairing_id, scheduled_at, status, week_number)
values ('0e000000-0000-0000-0000-000000000011', '0d000000-0000-0000-0000-000000000010',
        now() + interval '3 days', 'scheduled', 6)
on conflict (id) do nothing;

-- 8. Two messages, so the thread is not empty.
insert into messages (pairing_id, sender_id, body, created_at)
select '0d000000-0000-0000-0000-000000000010',
       (select id from users where email = 'chadhensel@gmail.com'),
       'Got time on the calendar. Send your note over when it is ready and I will read it before we talk.',
       now() - interval '2 days'
where not exists (select 1 from messages where pairing_id = '0d000000-0000-0000-0000-000000000010');

insert into messages (pairing_id, sender_id, body, created_at)
select '0d000000-0000-0000-0000-000000000010',
       (select id from users where email = 'chad.hensel@gmail.com'),
       'Will do. The five calls turned up something I did not expect.',
       now() - interval '2 days' + interval '20 minutes'
where (select count(*) from messages where pairing_id = '0d000000-0000-0000-0000-000000000010') < 2;
