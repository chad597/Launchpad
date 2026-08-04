"use client";

import { useActionState } from "react";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/form-state";

// Both halves of the meeting note are client forms for one reason: when the
// server rejects a submission it hands back what it read, and the form
// remounts with that text still in the boxes. Nobody retypes a note.

type Action = (state: FormState, formData: FormData) => Promise<FormState>;

function text(values: Record<string, unknown> | undefined, key: string): string {
  const v = values?.[key];
  return typeof v === "string" ? v : "";
}

function list(values: Record<string, unknown> | undefined, key: string): string[] {
  const v = values?.[key];
  return Array.isArray(v) ? v.map(String) : [];
}

export interface PriorItem {
  id: string;
  description: string;
  ownerFirst: string;
  dueDate: string;
  done: boolean;
}

export function FounderHalfForm({
  meetingId, mentorFirst, dueLabel, priorItems, action, returnTo, embedded = false,
}: {
  meetingId: string;
  mentorFirst: string;
  dueLabel: string;
  priorItems: PriorItem[];
  action: Action;
  returnTo?: string;
  embedded?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  const v = state.values;
  // Before the first attempt the checkboxes follow the stored item status.
  const done = state.attempt ? list(v, "done") : priorItems.filter((a) => a.done).map((a) => a.id);

  return (
    <>
      {state.error && <div className="banner bad" role="alert">{state.error}</div>}
      <form key={state.attempt} action={formAction}>
        <input type="hidden" name="meetingId" value={meetingId} />
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
        <div className={embedded ? "" : "card"} style={embedded ? undefined : { borderColor: "var(--teal)" }}>
          <div className="half-head">
            <h3>Your half</h3>
            <span className="pill warn">Due {dueLabel}</span>
          </div>
          <p className="meta" style={{ marginTop: 0 }}>
            {mentorFirst} reads this before you meet, so the meeting can start as a conversation. Be honest rather than optimistic; a flat 7 every week helps no one.
          </p>
          {priorItems.length > 0 && (
            <div className="formrow"><span className="label">Last meeting&rsquo;s action items</span>
              <ul className="bare">
                {priorItems.map((a) => (
                  <li key={a.id}>
                    <label style={{ display: "inline", textTransform: "none", letterSpacing: 0, fontWeight: 400, fontSize: ".87rem", color: "var(--ink)" }}>
                      <input type="checkbox" name="done" value={a.id} defaultChecked={done.includes(a.id)} style={{ width: "auto", marginRight: ".4rem" }} />
                      {a.description} <span className="meta">({a.ownerFirst}, due {a.dueDate})</span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".8rem" }}>
            <div className="formrow"><label htmlFor="statusFlag">Status</label>
              <select id="statusFlag" name="statusFlag" defaultValue={text(v, "statusFlag") || "on_track"}>
                <option value="on_track">On track</option>
                <option value="at_risk">At risk</option>
                <option value="off_track">Off track</option>
              </select>
            </div>
            <div className="formrow"><label htmlFor="confidence">Confidence (1 to 10)</label>
              <input type="text" inputMode="numeric" id="confidence" name="confidence"
                defaultValue={state.attempt ? text(v, "confidence") : "6"} />
            </div>
          </div>
          <div className="formrow"><label htmlFor="whatMoved">What moved (one per line)</label>
            <textarea id="whatMoved" name="whatMoved" defaultValue={text(v, "whatMoved")} placeholder="What you actually did. Conversations had, tests run, things built." required />
          </div>
          <div className="formrow"><label htmlFor="changedThinking">What changed your thinking this week?</label>
            <textarea id="changedThinking" name="changedThinking" defaultValue={text(v, "changedThinking")} placeholder="An assumption that broke, a pattern you noticed, a decision you now see differently." />
          </div>
          <div className="formrow"><label htmlFor="needHelp">Where I need help</label>
            <textarea id="needHelp" name="needHelp" defaultValue={text(v, "needHelp")} placeholder="One or two specific things tied to what this mentor knows." required />
          </div>
          <div className="formrow"><label htmlFor="focusNextWeek">My focus for next week (one per line)</label>
            <textarea id="focusNextWeek" name="focusNextWeek" defaultValue={text(v, "focusNextWeek")} placeholder="Your best guess. Your mentor will confirm, sharpen, or redirect it." />
          </div>
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Sharing..." : `Share with ${mentorFirst}`}
          </button>
          <div className="notice">Once you share it, {mentorFirst} can read it and add their half. You&rsquo;ll both see the whole note.</div>
        </div>
      </form>
    </>
  );
}

export function MentorHalfForm({
  meetingId, mentorFirst, founderFirst, founderId, mentorId, action, returnTo, embedded = false,
}: {
  meetingId: string;
  mentorFirst: string;
  founderFirst: string;
  founderId: string;
  mentorId: string;
  action: Action;
  returnTo?: string;
  embedded?: boolean;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  const v = state.values;

  return (
    <>
      {state.error && <div className="banner bad" role="alert" style={{ marginTop: "1rem" }}>{state.error}</div>}
      <form key={state.attempt} action={formAction}>
        <input type="hidden" name="meetingId" value={meetingId} />
        {returnTo && <input type="hidden" name="returnTo" value={returnTo} />}
        <div className={embedded ? "" : "card"} style={embedded ? undefined : { marginTop: "1rem", borderColor: "var(--teal)" }}>
          <div className="half-head">
            <h3>{mentorFirst}&rsquo;s half</h3>
            <span className="pill warn">In progress · submit to complete the record</span>
          </div>
          <div className="formrow"><label htmlFor="read">Read: does the self-assessment match what you saw?</label>
            <textarea id="read" name="read" defaultValue={text(v, "read")} required /></div>
          <div className="formrow"><label htmlFor="seeing">What I&rsquo;m seeing (one per line)</label>
            <textarea id="seeing" name="seeing" defaultValue={text(v, "seeing")} /></div>
          <div className="formrow"><label htmlFor="risks">Risks (one per line)</label>
            <textarea id="risks" name="risks" defaultValue={text(v, "risks")} /></div>
          <div className="formrow"><label htmlFor="focus">Focus for next week, adjustments (one per line)</label>
            <textarea id="focus" name="focus" defaultValue={text(v, "focus")} /></div>
          <div className="formrow"><label htmlFor="take">My take</label>
            <textarea id="take" name="take" defaultValue={text(v, "take")} required /></div>
        </div>
        <div className={embedded ? "" : "card"} style={{ marginTop: "1rem", ...(embedded ? {} : { borderColor: "var(--orange)" }) }}>
          <div className="half-head"><h3>Outcomes</h3><span className="pill info">Closed together, at the end of the meeting</span></div>
          <div className="formrow"><label htmlFor="keyInsight">Key insight</label>
            <input type="text" id="keyInsight" name="keyInsight" defaultValue={text(v, "keyInsight")} /></div>
          <div className="formrow"><label htmlFor="decisionMade">Decision made (optional)</label>
            <input type="text" id="decisionMade" name="decisionMade" defaultValue={text(v, "decisionMade")} /></div>
          <div className="formrow"><span className="label">Action items</span>
            <p className="help" style={{ marginTop: 0 }}>
              These three rows are where action items come from. What you write here lands on {founderFirst}&rsquo;s home screen, and it opens the next note as a checklist you both review together. Leave them blank and the pair has nothing to track between meetings.
            </p>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr", gap: ".5rem", marginBottom: ".5rem" }}>
                <input type="text" name={`action_${i}`} defaultValue={text(v, `action_${i}`)}
                  placeholder="What happens next" aria-label={`Action ${i + 1}`} />
                <select name={`action_owner_${i}`} aria-label={`Owner for action ${i + 1}`}
                  defaultValue={text(v, `action_owner_${i}`) || founderId}>
                  <option value={founderId}>{founderFirst}</option>
                  <option value={mentorId}>{mentorFirst}</option>
                </select>
                <input type="date" name={`action_due_${i}`} defaultValue={text(v, `action_due_${i}`)}
                  aria-label={`Due date for action ${i + 1}`} />
              </div>
            ))}
          </div>
          <button className="btn" type="submit" disabled={pending}>
            {pending ? "Submitting..." : "Submit the finished note"}
          </button>
          <div className="notice">Submitting marks the meeting complete and sends the full note to {founderFirst}. Open action items appear on their home screen and start the next note.</div>
        </div>
      </form>
    </>
  );
}
