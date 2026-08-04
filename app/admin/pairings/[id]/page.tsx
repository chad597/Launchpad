import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import {
  actionItemsForPairing, currentTime, getPairing, getUser, meetingsForPairing,
  messagesForPairing, noteForMeeting, openFlags, writeAudit,
} from "@/lib/data";
import { computePairHealth } from "@/lib/health";
import { AdminNav } from "../../nav";
import type { MeetingNote } from "@/lib/types";

const HEALTH_PILL = { healthy: "good", watch: "warn", attention: "crit" } as const;
const HEALTH_LABEL = { healthy: "Healthy", watch: "Watch", attention: "Attention" } as const;
const STATUS_LABEL = { on_track: "On track", at_risk: "At risk", off_track: "Off track" } as const;
const STATUS_PILL = { on_track: "good", at_risk: "warn", off_track: "crit" } as const;

function fmt(dt: string) {
  return new Date(dt).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: "America/New_York",
  });
}

function fmtDay(dt: string) {
  return new Date(dt).toLocaleString("en-US", {
    month: "short", day: "numeric", timeZone: "America/New_York",
  });
}

// Everything the program knows about one pairing, on one screen: who they are,
// whether the relationship is working, what they agreed, and what they said to
// each other. Reading it is recorded, the same as opening the conversation.
export default async function PairingDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (user.role !== "admin") {
    return <div className="wrap"><p className="meta">This view is for program admins.</p></div>;
  }
  const pairing = await getPairing(id);
  if (!pairing) notFound();

  const [founder, mentor, meetings, messages, items, flags, now] = await Promise.all([
    getUser(pairing.founderId),
    getUser(pairing.mentorId),
    meetingsForPairing(pairing.id),
    messagesForPairing(pairing.id),
    actionItemsForPairing(pairing.id),
    openFlags(),
    currentTime(),
  ]);
  if (!founder || !mentor) notFound();

  const notes: (MeetingNote | undefined)[] = await Promise.all(
    meetings.map((m) => noteForMeeting(m.id))
  );
  const noteFor = new Map(meetings.map((m, i) => [m.id, notes[i]]));
  const health = computePairHealth({
    pairing, founder, mentor, meetings,
    notes: notes.filter(Boolean) as MeetingNote[], messages, now,
  });

  // Same rule as the conversation view: staff access to a pair's private
  // record is part of the who-knew-what-when history.
  await writeAudit({
    actorId: user.id, action: "pairing.read_by_staff", subjectType: "pairing",
    subjectId: pairing.id, metadata: { founder: founder.name, mentor: mentor.name },
  });

  const people = new Map([[founder.id, founder], [mentor.id, mentor]]);
  const pairFlags = flags.filter((f) => f.pairingId === pairing.id);
  const openItems = items.filter((i) => i.status !== "done");
  const doneItems = items.filter((i) => i.status === "done");
  const completed = meetings.filter((m) => m.status === "completed");
  const timeline = [...meetings].reverse();

  return (
    <div className="wrap">
      <AdminNav current="/admin/pairings" />
      <p className="meta" style={{ margin: "0 0 .3rem" }}>
        <Link className="linklike" href="/admin">Health board</Link> · <Link className="linklike" href="/admin/pairings">All pairings</Link>
      </p>
      <div className="half-head">
        <h1 className="page" style={{ margin: 0 }}>{founder.name} · {mentor.name}</h1>
        <span className={`pill ${HEALTH_PILL[health.health]}`}>{HEALTH_LABEL[health.health]}</span>
        <span className="pill info">{pairing.status}</span>
      </div>
      <p className="sub">{health.signal}. Opening this page is recorded in the audit log.</p>

      <div className="stat-row">
        <div className="stat">
          <div className="n">{health.lastMetDaysAgo != null ? health.lastMetDaysAgo : "—"}</div>
          <div className="l">Days since they met</div>
          <div className="d">{completed.length} meeting{completed.length === 1 ? "" : "s"} so far</div>
        </div>
        <div className="stat">
          <div className="n">{health.nextMeeting ? fmtDay(health.nextMeeting.scheduledAt) : "None"}</div>
          <div className="l">Next meeting</div>
          <div className="d">{health.nextMeeting ? "Booked" : "Nothing on the calendar"}</div>
        </div>
        <div className="stat">
          <div className="n">{health.rhythmDays != null ? `${health.rhythmDays}d` : "—"}</div>
          <div className="l">How often they meet</div>
          <div className="d">{health.rhythmDays != null ? "From the meetings they held" : "Needs a second meeting"}</div>
        </div>
        <div className="stat">
          <div className="n">{health.notesComplete} / {health.notesExpected}</div>
          <div className="l">Note halves in</div>
          <div className="d">{health.notesComplete === health.notesExpected ? "Complete" : "Someone owes a half"}</div>
        </div>
        <div className="stat">
          <div className="n">{openItems.length}</div>
          <div className="l">Open action items</div>
          <div className="d">{doneItems.length} closed</div>
        </div>
      </div>

      <div className="grid two">
        <div>
          <div className="card">
            <h2>Meetings and notes</h2>
            {timeline.length === 0 && <p className="meta" style={{ margin: 0 }}>Nothing booked yet.</p>}
            {timeline.map((m) => {
              const n = noteFor.get(m.id);
              const fs = n?.founderSection;
              const ms = n?.mentorSection;
              return (
                <details key={m.id} className="flag" open={m.status !== "completed"}>
                  <summary style={{ cursor: "pointer" }}>
                    <b style={{ fontSize: ".9rem" }}>Week {m.weekNumber} · {fmt(m.scheduledAt)}</b>{" "}
                    {n?.statusFlag && (
                      <span className={`pill ${STATUS_PILL[n.statusFlag]}`}>{STATUS_LABEL[n.statusFlag]}</span>
                    )}{" "}
                    {n?.confidence != null && <span className="pill info">Confidence {n.confidence}/10</span>}{" "}
                    <span className={`pill ${n?.founderSubmittedAt ? "good" : "warn"}`}>
                      {founder.name.split(" ")[0]} {n?.founderSubmittedAt ? "in" : "outstanding"}
                    </span>{" "}
                    <span className={`pill ${n?.mentorSubmittedAt ? "good" : "warn"}`}>
                      {mentor.name.split(" ")[0]} {n?.mentorSubmittedAt ? "in" : "outstanding"}
                    </span>
                  </summary>

                  {fs ? (
                    <div style={{ marginTop: ".6rem" }}>
                      <span className="label">What moved</span>
                      <ul>{fs.whatMoved.map((x) => <li key={x}>{x}</li>)}</ul>
                      {fs.whatChangedMyThinking && (
                        <><span className="label">What changed their thinking</span>
                          <div className="filled">{fs.whatChangedMyThinking}</div></>
                      )}
                      <span className="label">Where they need help</span>
                      <div className="filled">{fs.whereINeedHelp}</div>
                      {fs.focusNextWeek.length > 0 && (
                        <><span className="label">Their focus next</span>
                          <ul>{fs.focusNextWeek.map((x) => <li key={x}>{x}</li>)}</ul></>
                      )}
                    </div>
                  ) : (
                    <p className="meta">No founder half yet.</p>
                  )}

                  {ms ? (
                    <div style={{ marginTop: ".6rem" }}>
                      <span className="label">{mentor.name.split(" ")[0]}&rsquo;s read</span>
                      <div className="filled">{ms.read}</div>
                      {ms.risks.length > 0 && (
                        <><span className="label">Risks</span>
                          <ul>{ms.risks.map((x) => <li key={x}>{x}</li>)}</ul></>
                      )}
                      {ms.whatImSeeing.length > 0 && (
                        <><span className="label">What they&rsquo;re seeing</span>
                          <ul>{ms.whatImSeeing.map((x) => <li key={x}>{x}</li>)}</ul></>
                      )}
                      <span className="label">Their take</span>
                      <div className="filled">{ms.myTake}</div>
                    </div>
                  ) : (
                    <p className="meta">No mentor half yet.</p>
                  )}

                  {(n?.keyInsight || n?.decisionMade) && (
                    <div style={{ marginTop: ".6rem" }}>
                      {n.keyInsight && (<><span className="label">Key insight</span><div className="filled">{n.keyInsight}</div></>)}
                      {n.decisionMade && (<><span className="label">Decision</span><div className="filled">{n.decisionMade}</div></>)}
                    </div>
                  )}

                  <p className="meta" style={{ marginBottom: 0 }}>
                    <Link className="linklike" href={`/note/${m.id}`}>Open the full note</Link>
                  </p>
                </details>
              );
            })}
          </div>

          <div className="card">
            <h2>Conversation</h2>
            <p className="meta" style={{ margin: "0 0 .6rem" }}>
              {messages.length} message{messages.length === 1 ? "" : "s"}. Both of them were told at onboarding that staff can read this.
            </p>
            {messages.length === 0 && <p className="meta" style={{ margin: 0 }}>Nothing sent yet.</p>}
            {messages.map((m) => {
              const sender = people.get(m.senderId);
              return (
                <div className="msg" key={m.id}>
                  <span className={`avatar${m.senderId === mentor.id ? " o" : ""}`}>
                    {(sender?.name ?? "?").split(" ").map((w) => w[0]).join("")}
                  </span>
                  <div>
                    <div className="bubble">{m.body}</div>
                    <div className="t">{sender?.name.split(" ")[0] ?? "…"} · {fmt(m.createdAt)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div>
          <div className="card">
            <h2>Why these two</h2>
            <p style={{ fontSize: ".9rem", margin: 0 }}>
              {pairing.matchRationale || "No rationale was recorded for this pairing."}
            </p>
          </div>

          <div className="card">
            <h2>{founder.name}</h2>
            <p className="meta" style={{ margin: "0 0 .4rem" }}>Founder · {founder.email}</p>
            {founder.company && <p style={{ fontSize: ".9rem", margin: "0 0 .2rem" }}>{founder.company}</p>}
            {founder.stage && <p className="meta" style={{ margin: 0 }}>{founder.stage}</p>}
          </div>

          <div className="card">
            <h2>{mentor.name}</h2>
            <p className="meta" style={{ margin: "0 0 .4rem" }}>Mentor · {mentor.email}</p>
            {mentor.bio && <p style={{ fontSize: ".9rem", margin: "0 0 .2rem" }}>{mentor.bio}</p>}
            {mentor.expertise?.length ? (
              <div>{mentor.expertise.map((e) => <span className="chip" key={e}>{e}</span>)}</div>
            ) : null}
            <p className="meta" style={{ margin: ".4rem 0 0" }}>
              {mentor.availability ? `Usually free: ${mentor.availability}` : "No availability set"}
            </p>
          </div>

          <div className="card">
            <h2>Action items</h2>
            {items.length === 0 && <p className="meta" style={{ margin: 0 }}>Nothing agreed yet.</p>}
            <ul className="bare">
              {[...openItems, ...doneItems].map((a) => (
                <li key={a.id} style={{ fontSize: ".87rem", marginBottom: ".3rem" }}>
                  {a.status === "done" ? "☑" : "☐"} {a.description}{" "}
                  <span className="meta">({people.get(a.ownerId)?.name.split(" ")[0] ?? "…"}, due {a.dueDate})</span>
                </li>
              ))}
            </ul>
          </div>

          {pairFlags.length > 0 && (
            <div className="card">
              <h2>Open flags</h2>
              {pairFlags.map((f) => (
                <div className="flag" key={f.id}>
                  <b style={{ fontSize: ".88rem" }}>
                    {f.category.replace("_", " ")} · {people.get(f.raisedById)?.name ?? "Someone"}
                  </b>
                  <p className="meta" style={{ margin: ".2rem 0 0" }}>&ldquo;{f.body}&rdquo;</p>
                </div>
              ))}
            </div>
          )}

          <div className="card">
            <h2>Act on this pair</h2>
            <p className="meta" style={{ margin: "0 0 .6rem" }}>
              Status and dissolving are on the pairings list.
            </p>
            <Link className="btn ghost" href={`/messages/${pairing.id}`}>Open the conversation</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
