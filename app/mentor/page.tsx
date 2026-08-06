import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser, homeForRole } from "@/lib/session";
import { getFounderProfile, getForm, needsProfile, type FounderProfile } from "@/lib/forms";
import {
  currentTime, getUser, lastCompletedMeeting, meetingsForPairing, messagesForPairing,
  nextMeetingForPairing, noteForMeeting, pairingsForUser,
} from "@/lib/data";
import { meetingRhythmDays } from "@/lib/health";
import { bookingOptions } from "@/lib/availability";
import { completeMentorHalf, postMessage } from "../actions";
import { AnswerList } from "../answers";
import { Thread, type ThreadMessage } from "../thread";
import { BookMeeting } from "../book-meeting";
import { MentorHalfForm } from "../note/note-forms";
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
  thread: ThreadMessage[];
  // The meeting whose mentor half is still owed, if there is one.
  finishable: Meeting | null;
  // What the founder said at intake, and the brief they wrote for this pair.
  profile: FounderProfile;
}

export default async function MentorHome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; booked?: string }>;
}) {
  const { error, booked } = await searchParams;
  const user = await currentUser();
  if (user.role !== "mentor") redirect(homeForRole(user.role));
  // A newly accepted mentor completes their profile before anything else.
  if (await needsProfile(user.id)) redirect("/profile/setup");
  const pairs = await pairingsForUser(user.id);
  const now = await currentTime();
  const booking = bookingOptions(user.availability, now);
  // Read once, then rendered per founder: what a founder was asked is the
  // same for all of them.
  const [intakeForm, briefForm] = await Promise.all([
    getForm("founder-intake"), getForm("founder-brief"),
  ]);

  const views: PairView[] = await Promise.all(
    pairs.map(async (p) => {
      const [founder, next, last, meetings, msgs, profile] = await Promise.all([
        getUser(p.founderId),
        nextMeetingForPairing(p.id),
        lastCompletedMeeting(p.id),
        meetingsForPairing(p.id),
        messagesForPairing(p.id),
        getFounderProfile(p.founderId),
      ]);
      const nextNote = next ? (await noteForMeeting(next.id)) ?? null : null;
      const lastNote = last ? (await noteForMeeting(last.id)) ?? null : null;
      const initials = (n: string) => n.split(" ").map((w) => w[0]).join("");
      return {
        pairing: p, founder: founder!, next, nextNote, last, lastNote, profile,
        rhythmDays: meetingRhythmDays(meetings),
        // The founder half has to be in first: it is what the mentor reads
        // and responds to.
        finishable: last && lastNote?.founderSection && !lastNote.mentorSubmittedAt ? last : null,
        thread: msgs.map((m) => ({
          id: m.id, body: m.body, createdAt: fmt(m.createdAt),
          senderInitials: initials(m.senderId === user.id ? user.name : founder!.name),
          senderFirst: (m.senderId === user.id ? user.name : founder!.name).split(" ")[0],
          mine: m.senderId === user.id,
        })),
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
      {error && <div className="banner bad">{error}</div>}
      {booked && <div className="banner ok">Meeting booked. It is on both of your home screens now.</div>}
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

                {/* Who they are and what they are stuck on, open until the
                    first meeting has happened and folded away after that. */}
                {(v.profile.intake || v.profile.brief) && (
                  <details open={!v.last}>
                    <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: ".9rem" }}>
                      About {v.founder.name.split(" ")[0]}
                    </summary>
                    <div style={{ marginTop: ".6rem" }}>
                      {v.profile.brief && briefForm && (
                        <>
                          <p className="meta" style={{ margin: "0 0 .6rem" }}>
                            Written for you before your first meeting.
                          </p>
                          <AnswerList questions={briefForm.questions} answers={v.profile.brief} />
                          <hr className="divider" />
                        </>
                      )}
                      {intakeForm && (
                        <>
                          <p className="meta" style={{ margin: "0 0 .6rem" }}>
                            From the form they filled in when they joined the program.
                          </p>
                          <AnswerList questions={intakeForm.questions} answers={v.profile.intake} />
                        </>
                      )}
                    </div>
                  </details>
                )}
                {!v.profile.brief && (
                  <p className="meta" style={{ margin: ".2rem 0 0" }}>
                    {v.founder.name.split(" ")[0]} has not written their brief yet. It is the longer
                    version of where they stand and what they want from you.
                  </p>
                )}

                {/* What the founder wrote, so it is read before the meeting
                    without going anywhere. */}
                {v.nextNote?.founderSection && v.next && (
                  <details open>
                    <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: ".9rem" }}>
                      {v.founder.name.split(" ")[0]}&rsquo;s half, before {fmt(v.next.scheduledAt)}
                    </summary>
                    <div style={{ marginTop: ".5rem" }}>
                      <span className="label">What moved</span>
                      <ul>{v.nextNote.founderSection.whatMoved.map((x) => <li key={x}>{x}</li>)}</ul>
                      <span className="label">Where they need help</span>
                      <div className="filled">{v.nextNote.founderSection.whereINeedHelp}</div>
                      <p className="meta" style={{ marginBottom: 0 }}>
                        <Link className="linklike" href={`/note/${v.next.id}`}>Read the whole note</Link>
                      </p>
                    </div>
                  </details>
                )}

                {/* Their half of the last meeting, open and ready to write. */}
                {v.finishable ? (
                  <details open>
                    <summary style={{ cursor: "pointer", fontWeight: 700, fontSize: ".9rem" }}>
                      Your half of the note from {fmt(v.finishable.scheduledAt)}
                    </summary>
                    <MentorHalfForm
                      meetingId={v.finishable.id}
                      mentorFirst={user.name.split(" ")[0]}
                      founderFirst={v.founder.name.split(" ")[0]}
                      founderId={v.founder.id}
                      mentorId={user.id}
                      action={completeMentorHalf}
                      returnTo="/mentor"
                      booking={booking}
                      embedded
                    />
                  </details>
                ) : v.last && v.lastNote?.mentorSubmittedAt ? (
                  <p className="meta" style={{ margin: 0 }}>
                    Your half of the {fmt(v.last.scheduledAt)} note is in.{" "}
                    <Link className="linklike" href={`/note/${v.last.id}`}>Read it</Link>
                  </p>
                ) : null}

                <hr className="divider" />
                <BookMeeting
                  pairingId={v.pairing.id}
                  hasNext={!!v.next}
                  otherFirst={v.founder.name.split(" ")[0]}
                  availability={user.availability}
                  now={now}
                  availabilityIsMine
                />

                <hr className="divider" />
                <h3 style={{ margin: "0 0 .5rem" }}>Conversation</h3>
                <Thread
                  messages={v.thread}
                  pairingId={v.pairing.id}
                  otherFirst={v.founder.name.split(" ")[0]}
                  action={postMessage}
                />
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
            <h2>Where action items come from</h2>
            <p className="meta" style={{ margin: 0 }}>
              Your half of the meeting note is the only place they are set. Whatever you write under Outcomes shows up on your founder&rsquo;s home screen and opens the next note, so the two of you pick up where you left off.
            </p>
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
