import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, homeForRole } from "@/lib/session";
import { needsProfile } from "@/lib/forms";
import {
  currentTime, getUser, lastCompletedMeeting, meetingsForPairing, nextMeetingForPairing,
  noteForMeeting, pairingsForUser,
} from "@/lib/data";
import { meetingRhythmDays } from "@/lib/health";
import type { Meeting, MeetingNote, Pairing, User } from "@/lib/types";

function fmt(dt: string) {
  return new Date(dt).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });
}

const STATUS_LABEL = { on_track: "On track", at_risk: "At risk", off_track: "Off track" } as const;
const STATUS_PILL = { on_track: "good", at_risk: "warn", off_track: "crit" } as const;

interface PairView {
  pairing: Pairing;
  founder: User;
  next: Meeting | null;
  nextNote: MeetingNote | null;
  last: Meeting | null;
  lastNote: MeetingNote | null;
  rhythmDays: number | null;
}

export default async function MentorHome() {
  const user = await currentUser();
  if (user.role !== "mentor") redirect(homeForRole(user.role));
  // A newly accepted mentor completes their profile before anything else.
  if (await needsProfile(user.id)) redirect("/profile/setup");
  const pairs = await pairingsForUser(user.id);
  const now = await currentTime();

  const views: PairView[] = await Promise.all(
    pairs.map(async (p) => {
      const [founder, next, last, meetings] = await Promise.all([
        getUser(p.founderId),
        nextMeetingForPairing(p.id),
        lastCompletedMeeting(p.id),
        meetingsForPairing(p.id),
      ]);
      const nextNote = next ? (await noteForMeeting(next.id)) ?? null : null;
      const lastNote = last ? (await noteForMeeting(last.id)) ?? null : null;
      return {
        pairing: p, founder: founder!, next, nextNote, last, lastNote,
        rhythmDays: meetingRhythmDays(meetings),
      };
    })
  );

  const todo: string[] = [];
  for (const v of views) {
    if (v.nextNote?.founderSubmittedAt && !v.nextNote.mentorSubmittedAt && v.next) {
      todo.push(`Read ${v.founder.name.split(" ")[0]}'s meeting note before ${fmt(v.next.scheduledAt)}`);
    }
    if (v.last && v.lastNote && !v.lastNote.mentorSubmittedAt) {
      todo.push(`Finish your half of ${v.founder.name.split(" ")[0]}'s note from ${fmt(v.last.scheduledAt)}`);
    }
  }

  return (
    <div className="wrap">
      <h1 className="page">Your founders</h1>
      <p className="sub">{views.length} active pairing{views.length === 1 ? "" : "s"}</p>
      <div className="grid two">
        <div>
          {views.map((v) => {
            const latestNote = v.nextNote ?? v.lastNote;
            const overdueDays = v.last && v.lastNote && !v.lastNote.mentorSubmittedAt
              ? Math.floor((now.getTime() - new Date(v.last.scheduledAt).getTime()) / 86400000)
              : 0;
            return (
              <div className="card" key={v.pairing.id}>
                <div className="half-head">
                  <h3>{v.founder.name} · {v.founder.company}</h3>
                  {latestNote?.statusFlag && (
                    <span className={`pill ${STATUS_PILL[latestNote.statusFlag]}`}>{STATUS_LABEL[latestNote.statusFlag]}</span>
                  )}
                  {latestNote?.confidence != null && (
                    <span className="pill info">Confidence {latestNote.confidence}/10</span>
                  )}
                </div>
                <p className="meta" style={{ margin: ".2rem 0 .7rem" }}>
                  {v.founder.stage}
                  {v.rhythmDays != null ? ` · You meet about every ${v.rhythmDays} days` : ""}
                </p>
                <div style={{ display: "flex", gap: ".9rem", flexWrap: "wrap", alignItems: "center" }}>
                  {v.next ? (
                    <div><div className="meta">Next meeting</div><div style={{ fontWeight: 700 }}>{fmt(v.next.scheduledAt)}</div></div>
                  ) : v.last ? (
                    <div><div className="meta">Last meeting</div><div style={{ fontWeight: 700 }}>{fmt(v.last.scheduledAt)}</div></div>
                  ) : null}
                  {v.nextNote?.founderSubmittedAt && !v.nextNote.mentorSubmittedAt && <span className="pill good">Note received</span>}
                  {overdueDays > 1 && <span className="pill crit">Your half of the note is {overdueDays} days overdue</span>}
                </div>
                <hr className="divider" />
                {v.nextNote?.founderSubmittedAt && v.next && (
                  <><Link className="btn" href={`/note/${v.next.id}`}>Read {v.founder.name.split(" ")[0]}&rsquo;s note</Link>{" "}</>
                )}
                {v.last && v.lastNote && !v.lastNote.mentorSubmittedAt && (
                  <><Link className="btn" href={`/note/${v.last.id}`}>Finish the note</Link>{" "}</>
                )}
                <Link className="btn ghost" href={`/messages/${v.pairing.id}`}>Message</Link>
              </div>
            );
          })}
        </div>
        <div>
          <div className="card">
            <h2>This week</h2>
            {todo.length ? (
              <ul style={{ margin: ".2rem 0 0 1.1rem", padding: 0, fontSize: ".87rem" }}>
                {todo.map((t) => <li key={t}>{t}</li>)}
              </ul>
            ) : (
              <p className="meta" style={{ margin: 0 }}>All caught up.</p>
            )}
          </div>
          <div className="card">
            <h2>Availability &amp; capacity</h2>
            <p className="meta" style={{ margin: "0 0 .5rem" }}>
              {user.availability ? `Usually free: ${user.availability}` : "No availability set yet"} · {views.length} of {user.capacity ?? 1} founders
            </p>
            <Link className="btn ghost" href="/mentor/availability">Edit availability</Link>
          </div>
          <div className="card">
            <h2>Seeing a pattern?</h2>
            <p className="meta" style={{ margin: "0 0 .6rem" }}>
              If the same risk keeps showing up across founders, or a match isn&rsquo;t clicking, tell us. You don&rsquo;t need to manage it alone.
            </p>
            <Link className="btn ghost" href="/flag">Flag to the Launchpad team</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
