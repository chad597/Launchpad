import Link from "next/link";
import { currentUser } from "@/lib/session";
import {
  actionItemsForPairing, currentTime, getUser, messagesForPairing,
  meetingsForPairing, nextMeetingForPairing, noteForMeeting, pairingsForUser,
} from "@/lib/data";
import { bookMeeting, markActionItem, postMessage, submitFounderHalf } from "../actions";
import { Thread, type ThreadMessage } from "../thread";
import { FounderHalfForm, type PriorItem } from "../note/note-forms";

function fmt(dt: string) {
  return new Date(dt).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });
}

export default async function FounderHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await currentUser();
  const pairing = (await pairingsForUser(user.id))[0];
  if (!pairing) {
    return <div className="wrap"><h1 className="page">Welcome, {user.name}</h1><p className="sub">Your mentor match arrives in week 3. Until then, use Ask-A-Mentor and office hours.</p></div>;
  }
  const [mentor, next, items, allMsgs, meetings, now] = await Promise.all([
    getUser(pairing.mentorId),
    nextMeetingForPairing(pairing.id),
    actionItemsForPairing(pairing.id),
    messagesForPairing(pairing.id),
    meetingsForPairing(pairing.id),
    currentTime(),
  ]);
  if (!mentor) return null;
  const nextNote = next ? await noteForMeeting(next.id) : null;
  const noteDue = next ? new Date(new Date(next.scheduledAt).getTime() - 24 * 3600 * 1000) : null;
  const minutesLeft = noteDue ? Math.round((noteDue.getTime() - now.getTime()) / 60000) : null;
  const openItems = items.filter((a) => a.status === "open");
  const notes = await Promise.all(meetings.map((m) => noteForMeeting(m.id)));
  const confidences = notes.filter((n) => n?.confidence != null).map((n) => n!.confidence!);
  const people = new Map([[user.id, user], [mentor.id, mentor]]);
  // Items agreed at meetings before this one, which the note rolls forward.
  const earlier = new Set(
    next ? meetings.filter((m) => m.scheduledAt < next.scheduledAt).map((m) => m.id) : []
  );
  const priorItems: PriorItem[] = items
    .filter((a) => earlier.has(a.meetingId))
    .map((a) => ({
      id: a.id, description: a.description, dueDate: a.dueDate,
      ownerFirst: (a.ownerId === user.id ? user.name : mentor.name).split(" ")[0],
      done: a.status === "done",
    }));
  const thread: ThreadMessage[] = allMsgs.map((m) => {
    const sender = people.get(m.senderId);
    return {
      id: m.id, body: m.body, createdAt: fmt(m.createdAt),
      senderInitials: (sender?.name ?? "?").split(" ").map((w) => w[0]).join(""),
      senderFirst: sender?.name.split(" ")[0] ?? "…",
      mine: m.senderId === user.id,
    };
  });

  return (
    <div className="wrap">
      <h1 className="page">{greeting(now)}, {user.name.split(" ")[0]}</h1>
      <p className="sub">
        {next
          ? nextNote?.founderSubmittedAt
            ? <>Your next meeting is {fmt(next.scheduledAt)}. Your half of the note is in.</>
            : <>Your next meeting is {fmt(next.scheduledAt)}. Your half of the note is <span className="countdown">{dueLabel(minutesLeft)}</span>.</>
          : <>No meeting on the books yet. Booking one is the single most useful next step.</>}
      </p>
      {error && <div className="banner bad">{error}</div>}
      <div className="grid two">
        <div>
          <div className="card">
            <h2>Conversation with {mentor.name}</h2>
            <p className="meta" style={{ margin: "0 0 .6rem" }}>
              You do not have to wait for the next meeting. Ask here whenever something comes up.
            </p>
            <Thread
              messages={thread}
              pairingId={pairing.id}
              otherFirst={mentor.name.split(" ")[0]}
              action={postMessage}
            />
            <div className="notice">Program staff can access conversations for safety and program quality.</div>
          </div>
          <div className="card">
            <h2>Next meeting</h2>
            {next ? (
              <>
                <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{fmt(next.scheduledAt)}</div>
                <div className="meta">1:1 with {mentor.name} · Google Meet</div>
                <hr className="divider" />
                {nextNote?.founderSubmittedAt ? (
                  <>
                    <span className="pill good">Your half is in</span>{" "}
                    <Link className="linklike" href={`/note/${next.id}`}>Read the whole note</Link>
                    <div className="notice">{mentor.name.split(" ")[0]} reads it before you meet, so the time goes to the conversation instead of a recap.</div>
                  </>
                ) : (
                  <>
                    <p className="meta" style={{ margin: "0 0 .6rem" }}>
                      {mentor.name.split(" ")[0]} reads this before you meet, so fill it in here whenever you have a minute. It saves when you share it.
                    </p>
                    <FounderHalfForm
                      meetingId={next.id}
                      mentorFirst={mentor.name.split(" ")[0]}
                      dueLabel={fmt(noteDue!.toISOString())}
                      priorItems={priorItems}
                      action={submitFounderHalf}
                      returnTo="/founder"
                      embedded
                    />
                  </>
                )}
              </>
            ) : (
              <>
                <p className="meta" style={{ marginTop: 0 }}>
                  {mentor.availability
                    ? <>{mentor.name.split(" ")[0]} is usually free: {mentor.availability}.</>
                    : <>Pick a time that works for you both.</>}
                </p>
                <form action={bookMeeting}>
                  <input type="hidden" name="pairingId" value={pairing.id} />
                  <div className="formrow">
                    <label htmlFor="scheduledAt">Date and time</label>
                    <input type="datetime-local" id="scheduledAt" name="scheduledAt" required />
                  </div>
                  <button className="btn" type="submit">Book this meeting</button>
                </form>
                <div className="notice">Booking it sets your note deadline 24 hours before the meeting, so you both walk in prepared.</div>
              </>
            )}
            <hr className="divider" />
            <h2>Action items</h2>
            <ul className="meta" style={{ listStyle: "none", margin: 0, padding: 0, fontSize: ".85rem" }}>
              {items.map((a) => (
                <li key={a.id} style={{ margin: ".3rem 0" }}>
                  <form action={markActionItem} style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={a.id} />
                    <input type="hidden" name="pairingId" value={a.pairingId} />
                    <button className="linklike" aria-label={a.status === "done" ? "Mark open" : "Mark done"}>
                      {a.status === "done" ? "☑" : "☐"}
                    </button>
                  </form>{" "}
                  <span style={{ color: "var(--ink)" }}>{a.description}</span>{" "}
                  <span className="meta">({people.get(a.ownerId)?.name.split(" ")[0] ?? "…"} · due {a.dueDate})</span>
                </li>
              ))}
            </ul>
            {openItems.length === 0 && items.length > 0 && (
              <p className="meta" style={{ margin: ".4rem 0 0" }}>All done. They&rsquo;ll show up checked off in your next note.</p>
            )}
          </div>
        </div>
        <div>
          <div className="card">
            <h2>Your mentor</h2>
            <div style={{ display: "flex", gap: ".7rem", alignItems: "center" }}>
              <span className="avatar lg">{mentor.name.split(" ").map((w) => w[0]).join("")}</span>
              <div><div style={{ fontWeight: 700 }}>{mentor.name}</div><div className="meta">{mentor.bio}</div></div>
            </div>
            <div style={{ marginTop: ".6rem" }}>
              {mentor.expertise?.map((e) => <span className="chip" key={e}>{e}</span>)}
            </div>
            <hr className="divider" />
            <p className="meta" style={{ margin: 0 }}>
              <b style={{ color: "var(--ink-soft)" }}>Why you were matched:</b> {pairing.matchRationale}
            </p>
          </div>
          <div className="card">
            <h2>Your confidence, week by week</h2>
            {confidences.length > 0 ? (
              <ConfidenceSpark values={confidences} />
            ) : (
              <p className="meta">Shows up once your first meeting note is in.</p>
            )}
            <p className="meta" style={{ margin: ".3rem 0 0" }}>Six weeks from now, this is the clearest record of how your thinking moved.</p>
          </div>
          <div className="card">
            <h2>Need something else?</h2>
            <p className="meta" style={{ margin: "0 0 .6rem" }}>Quick question for any mentor? Post in Ask-A-Mentor. Want live time on one problem? Book office hours.</p>
            <a className="btn ghost" href="#">Ask-A-Mentor</a>{" "}
            <a className="btn ghost" href="#">Office hours</a>
            <hr className="divider" />
            <Link className="linklike" href="/flag">Something not working with your match? Tell the Launchpad team</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function greeting(now: Date) {
  const hour = Number(new Intl.DateTimeFormat("en-US", {
    hour: "numeric", hour12: false, timeZone: "America/New_York",
  }).format(now));
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

// Scales the unit and says "overdue" rather than sitting at a stuck "0h".
function dueLabel(minutes: number | null): string {
  if (minutes == null) return "due soon";
  if (minutes < 0) {
    const over = Math.abs(minutes);
    return over < 60 ? "overdue" : over < 2880 ? `overdue by ${Math.round(over / 60)}h` : `overdue by ${Math.round(over / 1440)} days`;
  }
  if (minutes < 60) return `due in ${minutes} minutes`;
  if (minutes < 2880) return `due in ${Math.round(minutes / 60)}h`;
  return `due in ${Math.round(minutes / 1440)} days`;
}

function ConfidenceSpark({ values }: { values: number[] }) {
  const w = 300, h = 64, pad = 14;
  // A single reading sits in the middle rather than pinned to the left edge.
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const x = (i: number) => (values.length === 1 ? w / 2 : pad + i * step);
  const y = (v: number) => h - 12 - (v / 10) * (h - 26);
  const pts = values.map((v, i) => `${x(i)},${y(v)}`).join(" ");
  const last = values[values.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Confidence trend: ${values.join(", ")} out of 10`}>
      <line x1={8} y1={h - 12} x2={w - 8} y2={h - 12} stroke="var(--line)" strokeWidth="1" />
      {values.length > 1 && (
        <polyline points={pts} fill="none" stroke="var(--teal-text)" strokeWidth="2" strokeLinecap="round" />
      )}
      {values.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={i === values.length - 1 ? 5 : 4}
          fill={i === values.length - 1 ? "var(--orange)" : "var(--teal-text)"} />
      ))}
      <text x={w - 10} y={14} textAnchor="end" fontSize="11" fill="var(--ink-soft)" fontWeight="700">{last} / 10</text>
    </svg>
  );
}
