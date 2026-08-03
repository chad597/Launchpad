import Link from "next/link";
import { currentUser } from "@/lib/session";
import {
  actionItemsForPairing, getUser, messagesForPairing, meetingsForPairing,
  nextMeetingForPairing, noteForMeeting, now, pairingsForUser,
} from "@/lib/store";
import { markActionItem } from "../actions";

function fmt(dt: string) {
  return new Date(dt).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });
}

export default async function FounderHome() {
  const user = await currentUser();
  const pairing = pairingsForUser(user.id)[0];
  if (!pairing) {
    return <div className="wrap"><h1 className="page">Welcome, {user.name}</h1><p className="sub">Your mentor match arrives in week 3. Until then, use Ask-A-Mentor and office hours.</p></div>;
  }
  const mentor = getUser(pairing.mentorId)!;
  const next = nextMeetingForPairing(pairing.id);
  const nextNote = next ? noteForMeeting(next.id) : null;
  const noteDue = next ? new Date(new Date(next.scheduledAt).getTime() - 24 * 3600 * 1000) : null;
  const hoursLeft = noteDue ? Math.max(0, Math.round((noteDue.getTime() - now().getTime()) / 3600000)) : null;
  const items = actionItemsForPairing(pairing.id);
  const openItems = items.filter((a) => a.status === "open");
  const msgs = messagesForPairing(pairing.id).slice(-2);
  const confidences = meetingsForPairing(pairing.id)
    .map((m) => noteForMeeting(m.id))
    .filter((n) => n?.confidence != null)
    .map((n) => n!.confidence!);

  return (
    <div className="wrap">
      <h1 className="page">Good afternoon, {user.name.split(" ")[0]}</h1>
      <p className="sub">
        {next
          ? nextNote?.founderSubmittedAt
            ? <>Your next meeting is {fmt(next.scheduledAt)}. Your half of the note is in.</>
            : <>Your next meeting is {fmt(next.scheduledAt)}. Your half of the note is due in <span className="countdown">{hoursLeft}h</span>.</>
          : <>No meeting on the books yet. Booking one is the single most useful next step.</>}
      </p>
      <div className="grid two">
        <div>
          <div className="card">
            <h2>Next meeting</h2>
            {next ? (
              <>
                <div style={{ fontWeight: 700, fontSize: "1.05rem" }}>{fmt(next.scheduledAt)}</div>
                <div className="meta">1:1 with {mentor.name} · Google Meet</div>
                <hr className="divider" />
                {nextNote?.founderSubmittedAt ? (
                  <span className="pill good">Your half is submitted</span>
                ) : (
                  <Link className="btn" href={`/note/${next.id}`}>Complete your half of the note</Link>
                )}{" "}
                <Link className="btn ghost" href={`/note/${next.id}`}>Open the note</Link>
                <div className="notice">{mentor.name.split(" ")[0]} reads your note before you meet, so the time goes to the conversation instead of a recap.</div>
              </>
            ) : (
              <button className="btn">Book a meeting</button>
            )}
            <hr className="divider" />
            <h2>Your action items</h2>
            <ul className="meta" style={{ listStyle: "none", margin: 0, padding: 0, fontSize: ".85rem" }}>
              {items.map((a) => (
                <li key={a.id} style={{ margin: ".3rem 0" }}>
                  <form action={markActionItem} style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={a.id} />
                    <button className="linklike" aria-label={a.status === "done" ? "Mark open" : "Mark done"}>
                      {a.status === "done" ? "☑" : "☐"}
                    </button>
                  </form>{" "}
                  <span style={{ color: "var(--ink)" }}>{a.description}</span>{" "}
                  <span className="meta">({getUser(a.ownerId)?.name.split(" ")[0]} · due {a.dueDate})</span>
                </li>
              ))}
            </ul>
            {openItems.length === 0 && items.length > 0 && (
              <p className="meta" style={{ margin: ".4rem 0 0" }}>All done. They&rsquo;ll show up checked off in your next note.</p>
            )}
          </div>
          <div className="card">
            <h2>Messages · {mentor.name}</h2>
            {msgs.map((m) => {
              const sender = getUser(m.senderId)!;
              const mine = m.senderId === user.id;
              return (
                <div className="msg" key={m.id}>
                  <span className={`avatar${mine ? " o" : ""}`}>{sender.name.split(" ").map((w) => w[0]).join("")}</span>
                  <div><div className="bubble">{m.body}</div><div className="t">{fmt(m.createdAt)}</div></div>
                </div>
              );
            })}
            <Link className="btn ghost" href={`/messages/${pairing.id}`}>Open conversation</Link>
            <div className="notice">Program staff can access conversations for safety and program quality.</div>
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
            <button className="linklike">Something not working with your match? Tell the Launchpad team</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ConfidenceSpark({ values }: { values: number[] }) {
  const w = 300, h = 64, pad = 14;
  const step = values.length > 1 ? (w - pad * 2) / (values.length - 1) : 0;
  const y = (v: number) => h - 12 - (v / 10) * (h - 26);
  const pts = values.map((v, i) => `${pad + i * step},${y(v)}`).join(" ");
  const last = values[values.length - 1];
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`Confidence trend: ${values.join(", ")} out of 10`}>
      <line x1={8} y1={h - 12} x2={w - 8} y2={h - 12} stroke="var(--line)" strokeWidth="1" />
      <polyline points={pts} fill="none" stroke="var(--teal-text)" strokeWidth="2" strokeLinecap="round" />
      {values.map((v, i) => (
        <circle key={i} cx={pad + i * step} cy={y(v)} r={i === values.length - 1 ? 5 : 4}
          fill={i === values.length - 1 ? "var(--orange)" : "var(--teal-text)"} />
      ))}
      <text x={w - 10} y={14} textAnchor="end" fontSize="11" fill="var(--ink-soft)" fontWeight="700">{last} / 10</text>
    </svg>
  );
}
