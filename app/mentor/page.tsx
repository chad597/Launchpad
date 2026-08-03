import Link from "next/link";
import { currentUser } from "@/lib/session";
import {
  getUser, lastCompletedMeeting, nextMeetingForPairing, noteForMeeting,
  now, pairingsForUser,
} from "@/lib/store";

function fmt(dt: string) {
  return new Date(dt).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });
}

const STATUS_LABEL = { on_track: "On track", at_risk: "At risk", off_track: "Off track" } as const;
const STATUS_PILL = { on_track: "good", at_risk: "warn", off_track: "crit" } as const;

export default async function MentorHome() {
  const user = await currentUser();
  const pairs = pairingsForUser(user.id);

  const todo: string[] = [];
  for (const p of pairs) {
    const founder = getUser(p.founderId)!;
    const next = nextMeetingForPairing(p.id);
    const nextNote = next ? noteForMeeting(next.id) : null;
    if (nextNote?.founderSubmittedAt && !nextNote.mentorSubmittedAt) {
      todo.push(`Read ${founder.name.split(" ")[0]}'s meeting note before ${fmt(next!.scheduledAt)}`);
    }
    const last = lastCompletedMeeting(p.id);
    const lastNote = last ? noteForMeeting(last.id) : null;
    if (last && lastNote && !lastNote.mentorSubmittedAt) {
      todo.push(`Finish your half of ${founder.name.split(" ")[0]}'s note from ${fmt(last.scheduledAt)}`);
    }
  }

  return (
    <div className="wrap">
      <h1 className="page">Your founders</h1>
      <p className="sub">{pairs.length} active pairing{pairs.length === 1 ? "" : "s"}</p>
      <div className="grid two">
        <div>
          {pairs.map((p) => {
            const founder = getUser(p.founderId)!;
            const next = nextMeetingForPairing(p.id);
            const nextNote = next ? noteForMeeting(next.id) : null;
            const last = lastCompletedMeeting(p.id);
            const lastNote = last ? noteForMeeting(last.id) : null;
            const latestNote = nextNote ?? lastNote;
            const overdueDays = last && lastNote && !lastNote.mentorSubmittedAt
              ? Math.floor((now().getTime() - new Date(last.scheduledAt).getTime()) / 86400000)
              : 0;
            return (
              <div className="card" key={p.id}>
                <div className="half-head">
                  <h3>{founder.name} · {founder.company}</h3>
                  {latestNote?.statusFlag && (
                    <span className={`pill ${STATUS_PILL[latestNote.statusFlag]}`}>{STATUS_LABEL[latestNote.statusFlag]}</span>
                  )}
                  {latestNote?.confidence != null && (
                    <span className="pill info">Confidence {latestNote.confidence}/10</span>
                  )}
                </div>
                <p className="meta" style={{ margin: ".2rem 0 .7rem" }}>{founder.stage} · Meets {p.declaredCadence.replace("_", " ")}</p>
                <div style={{ display: "flex", gap: ".9rem", flexWrap: "wrap", alignItems: "center" }}>
                  {next ? (
                    <div><div className="meta">Next meeting</div><div style={{ fontWeight: 700 }}>{fmt(next.scheduledAt)}</div></div>
                  ) : last ? (
                    <div><div className="meta">Last meeting</div><div style={{ fontWeight: 700 }}>{fmt(last.scheduledAt)}</div></div>
                  ) : null}
                  {nextNote?.founderSubmittedAt && !nextNote.mentorSubmittedAt && <span className="pill good">Note received</span>}
                  {overdueDays > 1 && <span className="pill crit">Your half of the note is {overdueDays} days overdue</span>}
                </div>
                <hr className="divider" />
                {nextNote?.founderSubmittedAt && next && (
                  <><Link className="btn" href={`/note/${next.id}`}>Read {founder.name.split(" ")[0]}&rsquo;s note</Link>{" "}</>
                )}
                {last && lastNote && !lastNote.mentorSubmittedAt && (
                  <><Link className="btn" href={`/note/${last.id}`}>Finish the note</Link>{" "}</>
                )}
                <Link className="btn ghost" href={`/messages/${p.id}`}>Message</Link>
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
            <p className="meta" style={{ margin: "0 0 .5rem" }}>1:1 windows: Tue and Thu afternoons · Capacity {pairs.length} of 2 founders</p>
            <button className="btn ghost">Edit availability</button>
          </div>
          <div className="card">
            <h2>Seeing a pattern?</h2>
            <p className="meta" style={{ margin: "0 0 .6rem" }}>
              If the same risk keeps showing up across founders, or a match isn&rsquo;t clicking, tell us. You don&rsquo;t need to manage it alone.
            </p>
            <button className="btn ghost">Flag to the Launchpad team</button>
          </div>
        </div>
      </div>
    </div>
  );
}
