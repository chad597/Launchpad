import { createClient } from "@supabase/supabase-js";
import {
  emailMentorHalfOverdue, emailNoMeetingBooked, emailNoteDue, emailNoteShared,
} from "@/lib/email";

// The reminder engine, run daily by Vercel cron.
//
// Uses the service role key so it can see every pairing regardless of RLS.
// Each rule records what it sent in `notifications`, and checks there first,
// so a person is never emailed twice about the same thing.
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function when(dt: string) {
  return new Date(dt).toLocaleString("en-US", {
    weekday: "long", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: "America/New_York",
  });
}

export async function GET(request: Request) {
  // Vercel cron sends this header; reject anything else in production.
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = request.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) return new Response("Not authorized", { status: 401 });
  }

  const sb = admin();
  if (!sb) return Response.json({ ok: false, error: "Service role key not configured" }, { status: 500 });

  const sent: string[] = [];
  const now = Date.now();
  const day = 86400000;

  // Already-sent guard: one notification of a given type per subject, ever.
  const { data: already } = await sb.from("notifications").select("type, payload").not("sent_at", "is", null);
  const seen = new Set((already ?? []).map((n: any) => `${n.type}:${n.payload?.subject ?? ""}`));
  const fresh = (type: string, subject: string) => !seen.has(`${type}:${subject}`);

  const { data: pairings } = await sb
    .from("pairings")
    .select("id, founder_id, mentor_id, declared_cadence, founder:founder_id(id,name,email), mentor:mentor_id(id,name,email)")
    .eq("status", "active");

  for (const p of (pairings ?? []) as any[]) {
    const founder = p.founder, mentor = p.mentor;
    if (!founder?.email || !mentor?.email) continue;

    const { data: meetings } = await sb
      .from("meetings").select("id, scheduled_at, status").eq("pairing_id", p.id)
      .order("scheduled_at", { ascending: true });
    const all = meetings ?? [];

    const next = all.find((m: any) => m.status === "scheduled" && new Date(m.scheduled_at).getTime() >= now);
    const done = all.filter((m: any) => m.status === "completed");
    const last = done.length ? done[done.length - 1] : null;

    // 1. Founder's half of the note, due 24h before the meeting.
    if (next) {
      const dueAt = new Date(next.scheduled_at).getTime() - day;
      const hoursLeft = Math.round((dueAt - now) / 3600000);
      const { data: note } = await sb
        .from("meeting_notes").select("founder_submitted_at, mentor_submitted_at")
        .eq("meeting_id", next.id).maybeSingle();

      if (!note?.founder_submitted_at && hoursLeft <= 72 && hoursLeft > 0) {
        const stage = hoursLeft <= 30 ? "t30" : "t72";
        const subj = `${next.id}:${stage}`;
        if (fresh("note.due", subj)) {
          const r = await emailNoteDue({
            to: founder.email, userId: founder.id, firstName: founder.name.split(" ")[0],
            mentorName: mentor.name, meetingWhen: when(next.scheduled_at),
            meetingId: next.id, hoursLeft,
          });
          if (r.ok) { await tag(sb, "note.due", subj); sent.push(`note.due ${founder.email}`); }
        }
      }

      // 2. Founder's half arrived: tell the mentor to read it.
      if (note?.founder_submitted_at && !note.mentor_submitted_at && fresh("note.shared", next.id)) {
        const r = await emailNoteShared({
          to: mentor.email, userId: mentor.id, mentorFirst: mentor.name.split(" ")[0],
          founderName: founder.name, meetingWhen: when(next.scheduled_at), meetingId: next.id,
        });
        if (r.ok) { await tag(sb, "note.shared", next.id); sent.push(`note.shared ${mentor.email}`); }
      }
    }

    // 3. Mentor's half still open after the meeting.
    if (last) {
      const daysOverdue = Math.floor((now - new Date(last.scheduled_at).getTime()) / day);
      const { data: note } = await sb
        .from("meeting_notes").select("mentor_submitted_at").eq("meeting_id", last.id).maybeSingle();
      if (!note?.mentor_submitted_at && daysOverdue >= 1) {
        const stage = daysOverdue >= 4 ? "d4" : daysOverdue >= 2 ? "d2" : "d1";
        const subj = `${last.id}:${stage}`;
        if (fresh("note.mentor_overdue", subj)) {
          const r = await emailMentorHalfOverdue({
            to: mentor.email, userId: mentor.id, mentorFirst: mentor.name.split(" ")[0],
            founderName: founder.name, meetingWhen: when(last.scheduled_at),
            meetingId: last.id, daysOverdue,
          });
          if (r.ok) { await tag(sb, "note.mentor_overdue", subj); sent.push(`overdue ${mentor.email}`); }
        }
      }
    }

    // 4. Nothing on the books. The strongest signal a pair is drifting.
    if (!next && last) {
      const daysSince = Math.floor((now - new Date(last.scheduled_at).getTime()) / day);
      if (daysSince >= 7) {
        const stage = daysSince >= 14 ? "d14" : "d7";
        const subj = `${p.id}:${stage}`;
        if (fresh("pair.no_meeting", subj)) {
          const a = await emailNoMeetingBooked({
            to: founder.email, userId: founder.id, firstName: founder.name.split(" ")[0],
            otherName: mentor.name, daysSince,
          });
          await emailNoMeetingBooked({
            to: mentor.email, userId: mentor.id, firstName: mentor.name.split(" ")[0],
            otherName: founder.name, daysSince,
          });
          if (a.ok) { await tag(sb, "pair.no_meeting", subj); sent.push(`no_meeting ${p.id}`); }
        }
      }
    }
  }

  return Response.json({ ok: true, sent: sent.length, detail: sent });
}

// Marks a reminder as delivered so the next run skips it.
/* eslint-disable @typescript-eslint/no-explicit-any */
async function tag(sb: any, type: string, subject: string) {
  await sb.from("notifications").insert({
    type, channel: "email", payload: { subject, marker: true }, sent_at: new Date().toISOString(),
  });
}
