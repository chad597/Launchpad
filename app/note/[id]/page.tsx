import { notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import {
  actionItemsForPairing, getMeeting, getPairing, getUser, noteForMeeting,
} from "@/lib/data";
import { completeMentorHalf } from "../../actions";

const STATUS_LABEL = { on_track: "On track", at_risk: "At risk", off_track: "Off track" } as const;
const STATUS_PILL = { on_track: "good", at_risk: "warn", off_track: "crit" } as const;

function fmt(dt: string) {
  return new Date(dt).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });
}

export default async function NotePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  const meeting = await getMeeting(id);
  if (!meeting) notFound();
  const pairing = await getPairing(meeting.pairingId);
  if (!pairing) notFound();
  const [founder, mentor, note, allItems] = await Promise.all([
    getUser(pairing.founderId),
    getUser(pairing.mentorId),
    noteForMeeting(meeting.id),
    actionItemsForPairing(pairing.id),
  ]);
  if (!founder || !mentor) notFound();
  const fs = note?.founderSection ?? null;
  const ms = note?.mentorSection ?? null;
  const priorItems = allItems.filter((a) => a.meetingId !== meeting.id);
  const people = new Map([[founder.id, founder], [mentor.id, mentor]]);
  const isMentor = user.id === mentor.id;
  const canFinish = isMentor && fs && !note?.mentorSubmittedAt;

  return (
    <div className="wrap narrow">
      <h1 className="page">1:1 meeting note · Week {meeting.weekNumber}</h1>
      <p className="sub">
        {founder.name} ({founder.company}) with {mentor.name} · {fmt(meeting.scheduledAt)} · Both of you see this whole note. No surprises on either side.
      </p>

      <div className="card">
        <div className="half-head">
          <h3>{founder.name.split(" ")[0]}&rsquo;s half</h3>
          {note?.founderSubmittedAt
            ? <span className="pill good">Submitted {fmt(note.founderSubmittedAt)}</span>
            : <span className="pill warn">Due 24 hours before the meeting</span>}
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

      {canFinish ? (
        <form action={completeMentorHalf}>
          <input type="hidden" name="meetingId" value={meeting.id} />
          <div className="card" style={{ marginTop: "1rem", borderColor: "var(--teal)" }}>
            <div className="half-head">
              <h3>{mentor.name.split(" ")[0]}&rsquo;s half</h3>
              <span className="pill warn">In progress · submit to complete the record</span>
            </div>
            <div className="formrow"><label htmlFor="read">Read: does the self-assessment match what you saw?</label>
              <textarea id="read" name="read" required /></div>
            <div className="formrow"><label htmlFor="seeing">What I&rsquo;m seeing (one per line)</label>
              <textarea id="seeing" name="seeing" /></div>
            <div className="formrow"><label htmlFor="risks">Risks (one per line)</label>
              <textarea id="risks" name="risks" /></div>
            <div className="formrow"><label htmlFor="focus">Focus for next week, adjustments (one per line)</label>
              <textarea id="focus" name="focus" /></div>
            <div className="formrow"><label htmlFor="take">My take</label>
              <textarea id="take" name="take" required /></div>
          </div>
          <div className="card" style={{ marginTop: "1rem", borderColor: "var(--orange)" }}>
            <div className="half-head"><h3>Outcomes</h3><span className="pill info">Closed together, at the end of the meeting</span></div>
            <div className="formrow"><label htmlFor="keyInsight">Key insight</label>
              <input type="text" id="keyInsight" name="keyInsight" /></div>
            <div className="formrow"><label htmlFor="decisionMade">Decision made (optional)</label>
              <input type="text" id="decisionMade" name="decisionMade" /></div>
            <div className="formrow"><span className="label">Action items</span>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: ".5rem", marginBottom: ".5rem" }}>
                  <input type="text" name={`action_${i}`} placeholder="What happens next" aria-label={`Action ${i + 1}`} />
                  <select name={`action_owner_${i}`} aria-label={`Owner for action ${i + 1}`}>
                    <option value={founder.id}>{founder.name.split(" ")[0]}</option>
                    <option value={mentor.id}>{mentor.name.split(" ")[0]}</option>
                  </select>
                  <input type="date" name={`action_due_${i}`} aria-label={`Due date for action ${i + 1}`} />
                </div>
              ))}
            </div>
            <button className="btn" type="submit">Submit the finished note</button>
            <div className="notice">Submitting marks the meeting complete and sends the full note to {founder.name.split(" ")[0]}. Open action items appear on their home screen and start the next note.</div>
          </div>
        </form>
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
