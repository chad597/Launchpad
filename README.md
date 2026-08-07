# Mentor App

Launchpad Tech Ventures mentorship platform: mentor matching with human final say, shared 1:1 meeting notes, action-item accountability, in-app messaging, and program health tracking.

Spec: see the living spec artifact (v1.5) — data model, cohort lifecycle, notification matrix, KPIs.

**[docs/handbook.md](docs/handbook.md)** is the operator's guide: what each role sees, why the workflows are shaped the way they are, how health and matching are scored, who can see what, and where every route lives. Read it before changing a workflow.

## Running the demo

The app currently runs in **demo mode**: all data is in-memory, seeded from `lib/fixtures.ts` (Greenville Cohort 7, week 4). No accounts or keys needed.

```bash
npm install
npm run dev
```

Open http://localhost:3000 and use the role switcher in the top bar to browse as Founder (Alex Rivera), Mentor (Sam Patel), or Admin (Chad). Mutations (messages, note submission, action items, match confirmation, flag resolution) persist for the life of the dev server.

## Going live (when the Launchpad accounts exist)

This app is built to run on org-owned accounts, not personal ones:

1. **GitHub** — create a Launchpad org, push this repo there.
2. **Supabase** — create a project under a Launchpad account, then apply `supabase/migrations/0001_init.sql` (schema + RLS: pair-scoped access, messages readable by pair + admin only, instructors excluded from messages, append-only messages and audit log). Enable magic-link auth. Seed people from the HubSpot export (`users` links to `auth.users` by email on first sign-in — see the `link_auth_user` trigger).
3. **Vercel** — create the project under a Launchpad team, set the env vars from `.env.example`, set `DEMO_MODE=false`.
4. **Google Calendar** — a program-owned account (e.g. mentorship@…) creates meeting events. Fill the `GOOGLE_CALENDAR_*` vars. Members never connect personal calendars.
5. **Email** — transactional sender (Resend or similar) for the reminder engine.

The data layer seam is `lib/store.ts`: every page and server action goes through its exported functions. To go live, re-implement those functions against Supabase (the schema matches `lib/types.ts` one-to-one) — the pages don't change.

## What's deliberately not built yet

- Reminder engine delivery (needs email keys; the trigger logic is specified in the spec's notification matrix)
- Google Calendar event creation (needs the program account)
- File sharing, Week-6 pulse, continuation flow, Office Hours module (Phase 2 per spec)
- HubSpot sync (Phase 1 is a CSV import; API sync later)

## House rules encoded in the UI

- Orange (#ff7a3d) is a fill color, never text on white (brand guide).
- Microcopy: sentence case, active voice, no em dashes, no internal vocabulary (ecosystem, visionary) in member-facing views.
- The meeting note is one shared document; no admin-only fields. Concerns go through Flag to staff.
- Pair messages: pair + admin only. Admin access is disclosed in-thread and audit-logged.
