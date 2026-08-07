# The Launchpad Mentor App

A working guide to what the app is, who it serves, and why it behaves the way it does.

This is the operator's handbook: written for program staff and for anyone
picking up the codebase. It explains the reasoning behind the workflows, not
just the steps. User-facing guides for mentors and founders are a separate,
shorter document, and do not exist yet.

Last reviewed: 5 August 2026.

---

## 1. What the app is

It is the system of record for Launchpad Tech Ventures' 1:1 mentorship track:
the place where mentors apply, founders describe what they need, staff make and
justify matches, pairs meet and write up what happened, and the program can see
which relationships are working while there is still time to fix the ones that
are not.

It replaces a stack of disconnected tools: two Typeforms whose answers used
different vocabulary and therefore could not be compared, a Google Sheet for
office-hours signups, mentor matching done from memory and a spreadsheet, and a
21-question weekly email form that almost nobody filled in.

HubSpot remains the CRM of record for the relationship with each person. This
app owns the program loop. Contacts import in from HubSpot; write-back is a
later phase.

**Stack**: Next.js on Vercel, Supabase for database and auth, Resend for email.
Live at `launchpad-mentor-app-chad-9864s-projects.vercel.app`.

---

## 2. Who it is for

Three roles, and only three. There is no instructor or observer role.
Instructors run cohorts but have no reason to be inside the mentorship record,
and giving them access would have meant deciding what they could read of a
private pair conversation.

**Founders** (15 to 20 per cohort) get a home screen with their mentor, their
next meeting, their half of the meeting note, the conversation thread, and the
weekly update. They see everything the program holds about them and everything
their mentor wrote in a shared note. They do not see staff flags about them.

**Mentors** (a pool of roughly 110, of whom a subset volunteer for 1:1 each
cohort) get one card per founder they carry: who the founder is, what they said
at intake, the brief written to them personally, the founder's weekly updates,
the meeting note waiting for their half, and the conversation. They see nothing
about other mentors or other founders.

**Admins** get the health board, the match report, the weekly roll-up, every
pairing record, the audit log, and the tools for people, cohorts, forms,
imports, and applicants. Admins can read pair conversations and private meeting
notes. This is disclosed to both parties at onboarding, and every such read is
written to the audit log, so there is a defensible who-knew-what-when record.

---

## 3. The program model the software encodes

The app is opinionated because the program is. Six decisions shape almost
everything.

**Rotating 12-week cohorts, evergreen app.** Three to six cohorts a year, each
15 to 20 founders. Mentors are not "in" a cohort; they volunteer for 1:1 duty
per cohort, and the pool for matching is that subset, filtered in week 2 and
matched in week 3.

**Matching happens at week 3, not week 1.** Founders need two weeks in the
program before they can describe what they actually need. The intake form is
filled at first sign-in; the match comes later.

**No program-set meeting cadence.** Each pair declares their own rhythm at
kickoff. This is why health is scored against their commitment rather than a
program standard: a monthly pair should not be chased on day 34.

**One shared meeting note, never two private ones.** No surprises on either
side. The founder writes their half before the meeting; the mentor writes
theirs after. Both read both. There are deliberately no admin-only fields in
the note. If a mentor needs to tell staff something privately, that is a
separate action (the flag), not a hidden box in a document the founder believes
they are reading in full.

**The mentor's half is the attendance record.** Not a checkbox, not the
founder's word. Submitting the mentor half is what marks a meeting completed.
Attendance data is therefore a by-product of work the mentor was doing anyway,
which is the only kind of data collection that survives contact with
volunteers.

**No personal calendar OAuth.** Nobody connects their Google account. A
program-owned account will create meeting events; the app's database is the
source of truth for what was scheduled.

---

## 4. Getting people into the app

This is the workflow with the least obvious shape, and the reason is worth
knowing.

**Nothing about access depends on sending email.** The `launchpadtv.com` DNS
sits at GoDaddy under an IT contractor who is on the way out, and the program
has no login for it. Magic links were removed entirely. Sign-in is email plus a
password the person set themselves, with optional Google sign-in that only
appears when `GOOGLE_SIGN_IN=true`.

**Nobody is invited by email; you hand out links.** On `/admin/people` each
person has an "Invite link" and a "Reset link" button. Clicking one produces a
single-use URL that you send by whatever channel you like: text, Slack, in
person. Invite links last 14 days, reset links 3. Only one live link exists per
person at a time, and only its hash is stored, so a link cannot be recovered
from the database after you have sent it.

**Self-registration is off.** Anyone holding the public key used to be able to
create an account. That is now disabled at the project level, with a
10-character password minimum. The only two routes reachable without an account
are the public mentor application and an invite link.

To add a person: create them on `/admin/people`, or import a batch on
`/admin/import`, then issue and send their invite link. They set a password and
they are in.

---

## 5. The mentor pipeline

**`/apply` is public.** No login, no account. This is the one page you can put
on a website or in an email to a prospect. The form is 17 questions and takes
about three minutes.

Its shape reflects a real disagreement with the previous version. The old
founder form asked for a "preferred mentor background" from a list like
*operator turned investor* and *corporate executive*, which filtered on résumé
prestige while the program's own copy says you do not need an exit. The
application now asks what you have done and what you can help a founder do,
ranked, from a fixed list of ten skills. That list is the shared vocabulary. The
founder form ranks against the identical list, which is the only reason the two
sides can be compared at all.

**Applications land in `/admin/applicants`.** You read, then accept or decline.
Accepting creates the mentor's user record and copies the answers matching
reads onto it. There is a CSV export with one column per question, generated
from the live form definition.

**Accepted mentors complete a short profile at first sign-in**
(`mentor-profile`, 8 questions). This is where capacity, availability,
preferred mentoring format, stage preference, and the avoid list come from:
"anything you would rather not be the go-to for." A founder's biggest problem
should never land with someone lukewarm about it, and asking directly is kinder
than inferring.

---

## 6. The founder intake

Every founder is forced through `founder-intake` (19 questions) at first
sign-in, before they can see anything else. It is the entire founder side of
matching, so it is not optional and not skippable.

Rules it follows:

- **Everything is mentor-visible.** There are no staff-only questions. The last
  question says so explicitly and points founders at the flag page for anything
  meant for the team alone.
- **Anything matching reads is a choice, not free text.** The old form's two
  richest questions were paragraphs, which nothing could match on.
- **`needs` is ranked and capped at three**, against the same ten skills
  mentors rank. Ranks are weighted 1.0 / 0.6 / 0.35 on both sides.
- **`strengths` asks what they already have covered**, so a match is not spent
  on a problem they have solved.
- **The founder sets the industry weight themselves** ("how much does it matter
  that your mentor has worked in your industry"), rather than the program
  deciding for them.

**The brief (`founder-brief`, 9 questions) is separate and comes later.** It
only unlocks once a pairing exists, because it is written to the mentor by name
rather than to the program, and because its content goes stale within weeks. Ten
minutes here buys back the first half of the first meeting.

---

## 7. Matching, and the match report

**The matcher is not built.** Pairing is manual today, done on
`/admin/pairings`: pick a founder, pick a mentor from the cohort's 1:1 pool
(their current load and stated capacity are shown in the dropdown), and write
the rationale. That rationale is not internal. Both people read it in their
intro.

**`/admin/matches` is the report, and it explains rather than decides.** Every
pairing, expandable, scored across eight criteria with a sentence attached to
each number.

| Criterion | Weight | What it reads |
|---|---|---|
| Top need | 25 | Founder's first need against the mentor's ranked skills |
| Other needs | 15 | Their second and third, weighted; docked if the mentor's best skill is one the founder already has covered |
| Nothing they avoid | 15 | The mentor's avoid list against the founder's needs |
| Same world | 5 / 10 / 15 | Industry overlap, weighted by how much the founder said it matters |
| Where they are | 10 | Founder's stage against the mentor's stage preference |
| Way of working | 10 | Both sides answered the same format question |
| Time and place | 8 | Time zones |
| Room for this | 5 | Mentor's load against their stated capacity |

Two rules make it trustworthy.

**Unanswered is never scored as zero.** A criterion neither side answered drops
out of the calculation entirely, and the row says it was "based on 6 of 8."
Scoring silence as a bad fit would make an unfinished intake look like a bad
match, and you would learn to distrust the number.

**Every number carries a sentence.** A score with no explanation is worse than
no score, because it looks authoritative. The report reads back things like
"Casey would rather not be the go-to for pricing, which is Priya's number 1."

An avoid-list collision with the founder's top need is raised as a warning, not
just a low score: that was the agreed hard filter. Rows worth attention are
tinted and can be filtered to on their own.

The scoring lives in `lib/match.ts`, deliberately separate from the page,
because it is what the real matcher will run when it is built.

---

## 8. The meeting loop

This is the heart of the program and the part mentors judge the software by.

1. **Either party books a meeting.** The booking picker offers days and times
   drawn from what the mentor said they are usually free, so it is not a blank
   calendar.
2. **The founder's half is due 24 hours before.** Status (on track, at risk,
   off track), confidence 1 to 10, last meeting's action items rolled forward
   as checkboxes, what moved, what changed your thinking this week, where they
   need help, and focus.
3. **The mentor reads it before they sit down.** That is the whole point of the
   deadline. A nudge goes out when the founder files.
4. **They meet.**
5. **The mentor writes their half**: their read, what they are seeing, risks,
   focus adjustments, their take, then Outcomes: key insight, decision made,
   and action items with an owner and a due date.
6. **Submitting the mentor half marks the meeting completed** and pushes those
   action items onto the founder's home screen and into the next note.

Notes are private to the pair and to admins. `/meetings` gives either party
their whole history rather than only the next one.

---

## 9. The weekly update

Redesigned in August 2026. The old version asked 21 questions and was rarely
filled in, for a diagnosable reason:

- 11 questions asked for something the program already held: email, company,
  website, one-line description, co-founder count, pitch deck, funding
  preference. None of them change week to week.
- 3 asked whether the founder met their mentor and "why not!?", which the
  meetings table answers more honestly and less accusingly.
- 2 asked the same "what other mentorship do you want" question in different
  words, which the intake form already ranks.
- 1 asked how complete the MVP was, as a percentage nobody defines the same way
  twice.

The new form asks 11 questions, nine of them a single click, with last week's
numbers already in the boxes so a normal week is a scan and a submit.

What it asks, and why:

- **Hours actually worked.** For a pre-revenue company this matters more than
  any revenue figure. A week with no hours in it is the earliest warning the
  program ever gets.
- **People outside your team you talked to.** The leading indicator at this
  stage. Revenue tells you what already happened; conversations tell you what
  is about to. The old form never asked.
- **One thing you finished.** Concrete, one line.
- **People using it, paying customers, money collected this week.** Collected
  this week rather than revenue to date, because to-date invites recall errors
  and the app can sum it anyway. Blank is a legitimate answer and means
  "nothing to count yet," which is not the same as zero.
- **Runway.** Nobody was asking, and it is the thing that ends these companies.
- **Confidence 1 to 10, on the same scale as the meeting note**, so the two sit
  on one line across twelve weeks.
- **What is in your way.** The question mentors say they read first, and the
  one survivor from the old form.
- **One thing Launchpad could do this week.** Actionable for staff, unlike
  "what other areas could you use mentorship in."
- **Optionally, a re-rank of what you need help with**, which writes straight
  back to the matching data. A founder can move their own match. Until now
  their needs were frozen at whatever they said in week one.

Filing twice in a week edits that week rather than creating a second entry, so
the trend stays one point per week. Reminders go out Thursday and Sunday to
anyone who has not filed.

Visible to the founder, their active mentor, and admins. Nobody else.

**Why it matters combined**: the weekly form is the only thing that moves
between meetings. Read next to the meeting notes and the chat history, it shows
whether a pair is talking about what is actually happening. A founder logging
zero conversations for three weeks while the notes discuss pricing strategy is
a visible mismatch.

---

## 10. Reading program health

**`/admin` (health board)** ranks every active pair worst first. Health is
computed, not entered:

- **No next meeting booked** is the strongest signal: watch at 7 days,
  attention at 14.
- **Drift from their own rhythm.** The app measures the median gap between
  meetings the pair has actually held, never from a single meeting. With one
  meeting there is no interval, and guessing one would flag pairs for missing a
  rhythm they never had. Grace is 25% of their own interval with a four-day
  floor. Drift is measured to the next booked meeting, so a biweekly pair who
  has just scheduled six weeks out is flagged today rather than in a month.
- **An incomplete meeting note** drops a pair to watch.
- **A silent thread** for 10 or more days is appended to the signal of a pair
  already in trouble, rather than being its own trigger.

**`/admin/weekly` (this week)** is the cohort read: who filed and who did not,
ordered by confidence, with a "barely moved" count, a runway warning, every
blocker in the founders' own words, and the list of everything founders asked
Launchpad for this week, collected in one place to work through on a Monday. It
leads with who did not file, because a missing update is itself the strongest
signal the form produces.

**`/admin/pairings/[id]`** is the full record of one relationship: meetings and
notes, the conversation, the weekly trend, the match score, action items,
flags. Opening it is audit-logged.

**Flags** (`/flag`) let either party tell staff something privately: this match
is not working, a pattern worth naming, a conduct concern, or something else.
The page says plainly that reassignment is normal and not a failure. Flags
categorised as "match not working" surface as change requests at the bottom of
the match report.

---

## 11. The forms system

Every questionnaire in the app (mentor application, mentor profile, founder
intake, founder brief, weekly update) is editable at `/admin/forms` without a
developer.

The design decision that makes this safe: there is no runtime schema change.
Questions are rows; answers are JSON keyed by a stable question key. Add, edit,
reorder, archive, restore. Archiving preserves answers already submitted; only a
question nothing has answered can be hard-deleted. The applicant list and CSV
export generate one column per question from the live definition.

Two cautions:

- **Editing an option's label is safe; changing its underlying value is not.**
  The values are the shared vocabulary that lets founder needs join to mentor
  skills. Rewording "Pricing" is fine. Replacing its value breaks matching for
  everyone who has already answered.
- **A handful of answers are copied onto the person's record** because matching
  reads them as columns. Archiving one of those questions leaves the column it
  fed alone rather than wiping it.

---

## 12. Who can see what

| | Founder | Their mentor | Admin |
|---|---|---|---|
| Founder intake answers | yes | yes | yes |
| Founder brief | yes | yes | yes |
| Weekly update | yes | yes | yes |
| Meeting note, both halves | yes | yes | yes, audit-logged |
| Pair conversation | yes | yes | yes, audit-logged |
| Flags raised to staff | raiser only | raiser only | yes |
| Match score and report | no | no | yes |
| Mentor's "anything we should know" | no | self | yes |

The disclosure that admins can read pair conversations is made at onboarding,
not buried. Founders and mentors also see a standing notice on the conversation
itself.

---

## 13. Reminders

One daily cron at 9am Eastern drives everything:

- Founder's note due, 72 and 30 hours before a meeting
- Mentor nudged when the founder shares their half
- Mentor's half overdue at 1, 2, and 4 days
- No meeting booked at 7 and 14 days
- Weekly update outstanding, Thursday and Sunday

Every send is recorded, and each rule checks that record first, so nobody is
emailed twice about the same thing. A failed email never breaks the action that
triggered it.

**Live constraint**: the Resend account is unverified, so it can currently only
send to `chad@launchpadtv.com`. Until `launchpadtv.com` is verified at
resend.com/domains, no reminder reaches an actual mentor or founder. This is the
single biggest gap between "built" and "running."

---

## 14. A week in each chair

**Founder.** Monday: file the weekly update, two minutes, most answers carried
over. Whenever: message the mentor, book the next meeting. The day before a
meeting: fill in your half of the note. After: check off action items as you do
them.

**Mentor.** Open your dashboard: one card per founder, with a to-do list at the
top saying exactly what is owed. Read the founder's week and their half of the
note before you sit down. After the meeting, write your half. That is what
closes the record and sets the next round of action items.

**Admin, weekly rhythm.** Monday morning: `/admin/weekly` for who did not file,
who has stalled, and what people asked for. Then `/admin` for anything red or
amber. Mid-week: work through the ask list and any open flags. Week 2 of a
cohort: confirm the 1:1 mentor pool on `/admin/cohorts`. Week 3: make the
matches on `/admin/pairings`, sanity-check them on `/admin/matches`, send the
intros. Week 6: match-quality pulse. Week 11: continuation ask, mentors first,
founders only if the mentor says yes, worded so the ask does not leak the
mentor's answer.

---

## 15. Current state

**Working**: authentication and invites, the admin section, all five forms with
the editor, the meeting note loop, booking, messaging, flags, the health board,
the match report, the weekly update, imports, the audit log, the reminder
engine.

**Not built**: the matcher itself. `match_suggestions` has a table and a UI,
but nothing writes to it, so pairing is manual. The scoring engine the report
runs is the piece that was missing. Both sides now rank against the same
vocabulary, so generating a ranked shortlist is a contained next job.

**Blocked on things outside the code**: Resend domain verification, and a
Google Cloud OAuth client for Google sign-in. The second needs no DNS access,
so it is unblocked whenever someone wants it.

**Demo mode**: running `npm run dev` locally with no Supabase credentials
starts the app on in-memory fixtures: five founders, seven mentors, five
pairings, meeting notes, five weeks of updates, and a role switcher in the
header. Nothing touches production data. It is the fastest way to click through
a flow, show someone the app, or check a change.

---

## 16. Where things live

| Route | Who | What |
|---|---|---|
| `/apply` | public | Mentor application |
| `/invite/[token]` | public | Redeem an invite or reset link, set a password |
| `/login` | public | Email and password, optional Google |
| `/founder` | founder | Home: mentor, next meeting, note, conversation |
| `/weekly` | founder | Weekly update and personal trend |
| `/profile/setup` | founder, mentor | Forced intake or profile at first sign-in |
| `/profile/brief` | founder | The brief written to their mentor |
| `/mentor` | mentor | One card per founder carried |
| `/mentor/availability` | mentor | When they are free, and capacity |
| `/meetings` | founder, mentor | Every meeting and note, past and future |
| `/note/[id]` | pair, admin | The shared meeting note |
| `/messages/[pairingId]` | pair, admin | The conversation |
| `/flag` | all | Tell staff something privately |
| `/admin` | admin | Health board |
| `/admin/weekly` | admin | This week across the cohort |
| `/admin/matches` | admin | Match report |
| `/admin/pairings` | admin | Make and manage pairings |
| `/admin/pairings/[id]` | admin | Full record of one pair |
| `/admin/people` | admin | Add, change role, deactivate, issue links |
| `/admin/import` | admin | CSV import with per-row preview |
| `/admin/applicants` | admin | Mentor application pipeline |
| `/admin/forms` | admin | Edit any questionnaire |
| `/admin/cohorts` | admin | Cohorts and the 1:1 mentor pool |
| `/admin/audit` | admin | Who read what, and when |
| `/api/cron/reminders` | cron | Daily reminder engine |
