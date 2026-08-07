import { notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import {
  actionItemsForPairing, currentTime, getMeeting, getPairing, getUser, meetingsForPairing,
  noteForMeeting, writeAudit,
} from "@/lib/data";
import { bookingOptions } from "@/lib/availability";
import { completeMentorHalf, submitFounderHalf } from "../../actions";
import { FounderHalfForm, MentorHalfForm, type PriorItem } from "../note-forms";

const STATUS_LABEL = { on_track: "On track", at_risk: "At risk", off_track: "Off track" } as const;
const STATUS_PILL = { on_track: "good", at_risk: "warn", off_track: "crit" } as const;

function fmt(dt: string) {
  return new Date(dt).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });
}

export default async function NotePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  const meeting = await getMeeting(id);
  if (!meeting) notFound();
  const pairing = await getPairing(meeting.pairingId);
  if (!pairing) notFound();
  const [founder, mentor, note, allItems, now] = await Promise.all([
    getUser(pairing.founderId),
    getUser(pairing.mentorId),
    noteForMeeting(meeting.id),
    actionItemsForPairing(pairing.id),
    currentTime(),
  ]);
  if (!founder || !mentor) notFound();

  // A meeting note is private to the pair and program admins.
  const isMember = user.id === founder.id || user.id === mentor.id;
  const isStaff = user.role === "admin";
  if (!isMember && !isStaff) {
    return (
      <div className="wrap narrow">
        <p className="meta">This meeting note is private to the pair and program staff.</p>
      </div>
    );
  }
  // Staff reads of a pair's private note are part of the who-knew-what-when
  // record, the same as their conversation.
  if (isStaff && !isMember) {
    await writeAudit({
      actorId: user.id, action: "note.read_by_staff", subjectType: "meeting",
      subjectId: meeting.id, metadata: { founder: founder.name, mentor: mentor.name },
    });
  }

  const fs = note?.founderSection ?? null;
  const ms = note?.mentorSection ?? null;
  // Items agreed at *earlier* meetings. Filtering only on "not this meeting"
  // pulled in items from future meetings too.
  const pairMeetings = await meetingsForPairing(pairing.id);
  const earlier = new Set(
    pairMeetings.filter((m) => m.scheduledAt < meeting.scheduledAt).map((m) => m.id)
  );
  const priorItems = allItems.filter((a) => earlier.has(a.meetingId));
  const people = new Map([[founder.id, founder], [mentor.id, mentor]]);
  const isMentor = user.id === mentor.id;
  const isFounder = user.id === founder.id;
  const canFinish = isMentor && fs && !note?.mentorSubmittedAt;
  const canWriteFounderHalf = isFounder && !note?.founderSubmittedAt;
  const dueAt = new Date(new Date(meeting.scheduledAt).getTime() - 24 * 3600 * 1000);
  const priorItemViews: PriorItem[] = priorItems.map((a) => ({
    id: a.id,
    description: a.description,
    ownerFirst: people.get(a.ownerId)?.name.split(" ")[0] ?? "…",
    dueDate: a.dueDate,
    done: a.status === "done",
  }));

  return (
    <div className="wrap narrow">
      <h1 className="page">1:1 meeting note · Week {meeting.weekNumber}</h1>
      <p className="sub">
        {founder.name} ({founder.company}) with {mentor.name} · {fmt(meeting.scheduledAt)} · {isStaff && !isMember
          ? "Staff view. This access is recorded in the audit log."
          : "Both of you see this whole note. No surprises on either side."}
      </p>
      {canWriteFounderHalf ? (
        <FounderHalfForm
          meetingId={meeting.id}
          mentorFirst={mentor.name.split(" ")[0]}
          dueLabel={fmt(dueAt.toISOString())}
          priorItems={priorItemViews}
          action={submitFounderHalf}
        />
      ) : (
      <div className="card">
        <div className="half-head">
          <h3>{isFounder ? "Your half" : `${founder.name.split(" ")[0]}’s half`}</h3>
          {note?.founderSubmittedAt
            ? <span className="pill good">Submitted {fmt(note.founderSubmittedAt)}</span>
            : <span className="pill warn">Due {fmt(dueAt.toISOString())}</span>}
          {note?.statusFlag && <span className={`pill ${STATUS_PILL[note.statusFlag]}`}>{STATUS_LABEL[note.statusFlag]}</span>}
          {note?.confidence != null && <span className="pill info">Confidence {note.confidence} / 10</span>}
        </div>
        {fs ? (
          <>
            {priorItems.length > 0 && (
              <div className="formrow"><span className="label">Last meeting&rsquo;s action items</span>
                <ul className="bare">
                  {priorItems.map((a) => (
                    <li key={a.id}>{a.status === "done" ? "☑" : "☐"} {a.description} <span className="meta">({people.get(a.ownerId)?.name.split(" ")[0] ?? "…"}, due {a.dueDate})</span></li>
                  ))}
                </ul>
              </div>
            )}
            <div className="formrow"><span className="label">What moved</span>
              <ul>{fs.whatMoved.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
            <div className="formrow"><span className="label">What changed your thinking this week?</span>
              <div className="filled">{fs.whatChangedMyThinking}</div>
            </div>
            <div className="formrow"><span className="label">Where I need help</span>
              <div className="filled">{fs.whereINeedHelp}</div>
            </div>
            <div className="formrow"><span className="label">My focus for next week (draft)</span>
              <ul>{fs.focusNextWeek.map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          </>
        ) : (
          <p className="meta" style={{ margin: 0 }}>Not submitted yet.</p>
        )}
      </div>
      )}

      {canFinish ? (
        <MentorHalfForm
          meetingId={meeting.id}
          mentorFirst={mentor.name.split(" ")[0]}
          founderFirst={founder.name.split(" ")[0]}
          founderId={founder.id}
          mentorId={mentor.id}
          action={completeMentorHalf}
          booking={bookingOptions(mentor.availability, now)}
        />
      ) : (
        <div className="card" style={{ marginTop: "1rem", borderColor: ms ? "var(--line)" : "var(--teal)" }}>
          <div className="half-head">
            <h3>{mentor.name.split(" ")[0]}&rsquo;s half</h3>
            {note?.mentorSubmittedAt
              ? <span className="pill good">Submitted {fmt(note.mentorSubmittedAt)}</span>
              : <span className="pill info">Completed during or after the meeting</span>}
          </div>
          {ms ? (
            <>
              <div className="formrow"><span className="label">Read</span><div className="filled">{ms.read}</div></div>
              {ms.whatImSeeing.length > 0 && <div className="formrow"><span className="label">What I&rsquo;m seeing</span><ul>{ms.whatImSeeing.map((x) => <li key={x}>{x}</li>)}</ul></div>}
              {ms.risks.length > 0 && <div className="formrow"><span className="label">Risks</span><ul>{ms.risks.map((x) => <li key={x}>{x}</li>)}</ul></div>}
              {ms.focusAdjustments.length > 0 && <div className="formrow"><span className="label">Focus for next week (adjustments)</span><ul>{ms.focusAdjustments.map((x) => <li key={x}>{x}</li>)}</ul></div>}
              <div className="formrow"><span className="label">My take</span><div className="filled">{ms.myTake}</div></div>
              {(note?.keyInsight || note?.decisionMade) && (
                <>
                  <hr className="divider" />
                  <div className="half-head"><h3>Outcomes</h3></div>
                  {note.keyInsight && <div className="formrow"><span className="label">Key insight</span><div className="filled">{note.keyInsight}</div></div>}
                  {note.decisionMade && <div className="formrow"><span className="label">Decision made</span><div className="filled">{note.decisionMade}</div></div>}
                </>
              )}
            </>
          ) : (
            <p className="meta" style={{ margin: 0 }}>Not submitted yet.</p>
          )}
        </div>
      )}
    </div>
  );
}
