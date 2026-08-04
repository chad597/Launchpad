import Link from "next/link";
import { currentUser } from "@/lib/session";
import {
  getUser, meetingsForPairing, noteForMeeting, pairingsForUser,
} from "@/lib/data";
import type { Meeting, MeetingNote, User } from "@/lib/types";

const STATUS_LABEL = { on_track: "On track", at_risk: "At risk", off_track: "Off track" } as const;
const STATUS_PILL = { on_track: "good", at_risk: "warn", off_track: "crit" } as const;

function fmt(dt: string) {
  return new Date(dt).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: "America/New_York",
  });
}

interface Row {
  meeting: Meeting;
  note: MeetingNote | undefined;
  other: User;
}

// Every meeting either side has had or has coming, so the record is reachable
// rather than only the next one.
export default async function MeetingsPage() {
  const user = await currentUser();
  if (user.role === "admin") {
    return (
      <div className="wrap">
        <p className="meta">
          Staff read meetings from a pairing. <Link className="linklike" href="/admin">Open the health board</Link>.
        </p>
      </div>
    );
  }

  const pairs = await pairingsForUser(user.id);
  const rows: Row[] = [];
  for (const p of pairs) {
    const otherId = user.role === "founder" ? p.mentorId : p.founderId;
    const [other, meetings] = await Promise.all([getUser(otherId), meetingsForPairing(p.id)]);
    if (!other) continue;
    for (const m of meetings) {
      rows.push({ meeting: m, note: await noteForMeeting(m.id), other });
    }
  }
  rows.sort((a, b) => b.meeting.scheduledAt.localeCompare(a.meeting.scheduledAt));

  const owed = rows.filter((r) =>
    user.role === "founder" ? !r.note?.founderSubmittedAt : r.note?.founderSubmittedAt && !r.note?.mentorSubmittedAt
  );

  return (
    <div className="wrap">
      <h1 className="page">Meetings and notes</h1>
      <p className="sub">
        {rows.length === 0
          ? "Nothing booked yet."
          : `${rows.length} meeting${rows.length === 1 ? "" : "s"}${owed.length ? `, ${owed.length} waiting on you` : ", nothing waiting on you"}.`}
      </p>

      {rows.length > 0 && (
        <div className="tablewrap">
          <table className="board">
            <thead>
              <tr><th>When</th><th>With</th><th>Week</th><th>Status</th><th>Note</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const mine = user.role === "founder"
                  ? r.note?.founderSubmittedAt : r.note?.mentorSubmittedAt;
                const theirs = user.role === "founder"
                  ? r.note?.mentorSubmittedAt : r.note?.founderSubmittedAt;
                return (
                  <tr key={r.meeting.id}>
                    <td>{fmt(r.meeting.scheduledAt)}</td>
                    <td>{r.other.name}</td>
                    <td>{r.meeting.weekNumber}</td>
                    <td>
                      {r.note?.statusFlag && (
                        <span className={`pill ${STATUS_PILL[r.note.statusFlag]}`}>
                          {STATUS_LABEL[r.note.statusFlag]}
                        </span>
                      )}
                      {r.note?.confidence != null && (
                        <> <span className="pill info">Confidence {r.note.confidence}/10</span></>
                      )}
                    </td>
                    <td>
                      <span className={`pill ${mine ? "good" : "warn"}`}>
                        {mine ? "Yours is in" : "Yours is open"}
                      </span>{" "}
                      <span className={`pill ${theirs ? "good" : "warn"}`}>
                        {theirs ? "Theirs is in" : "Theirs is open"}
                      </span>
                    </td>
                    <td><Link className="linklike" href={`/note/${r.meeting.id}`}>Open</Link></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
