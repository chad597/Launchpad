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
