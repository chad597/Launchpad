// Pair-health scoring per spec §6, pure so demo mode and the database share it.
// No-next-meeting is the strongest signal (yellow at 7 days unbooked, red at
// 14), then drift from the rhythm the pair has actually kept, then note
// compliance.
import type { Health, Meeting, MeetingNote, Message, PairHealth, Pairing, User } from "./types";

const dayMs = 24 * 3600 * 1000;

// How often this pair actually meets, in days, read from the meetings they
// have held rather than a cadence anyone declared up front. Median, so one
// long gap over the holidays does not redefine their normal.
//
// Null until they have met twice: with one meeting there is no interval to
// measure, and guessing one would flag pairs for missing a rhythm they never
// had.
export function meetingRhythmDays(meetings: Meeting[]): number | null {
  const held = meetings
    .filter((m) => m.status === "completed")
    .map((m) => new Date(m.scheduledAt).getTime())
    .sort((a, b) => a - b);
  if (held.length < 2) return null;

  const gaps: number[] = [];
  for (let i = 1; i < held.length; i++) gaps.push(Math.round((held[i] - held[i - 1]) / dayMs));
  gaps.sort((a, b) => a - b);
  const mid = Math.floor(gaps.length / 2);
  const median = gaps.length % 2 ? gaps[mid] : Math.round((gaps[mid - 1] + gaps[mid]) / 2);
  return Math.max(1, median);
}

// A pair meeting monthly should not be chased on day 34. Grace scales with
// their own interval, with a floor so weekly pairs get a few days too.
function graceDays(rhythm: number): number {
  return Math.max(4, Math.round(rhythm * 0.25));
}

export function computePairHealth(args: {
  pairing: Pairing;
  founder: User;
  mentor: User;
  meetings: Meeting[]; // sorted by scheduledAt asc
  notes: MeetingNote[];
  messages: Message[]; // sorted by createdAt asc
  now: Date;
}): PairHealth {
  const { pairing, founder, mentor, meetings, notes, messages, now } = args;
  const t = now.toISOString();

  const next =
    meetings.find((m) => m.status === "scheduled" && m.scheduledAt >= t) ?? null;
  const completed = meetings.filter((m) => m.status === "completed");
  const last = completed.length ? completed[completed.length - 1] : null;
  const lastMetDaysAgo = last
    ? Math.floor((now.getTime() - new Date(last.scheduledAt).getTime()) / dayMs)
    : null;

  const notesExpected = completed.length * 2;
  let notesComplete = 0;
  for (const m of completed) {
    const n = notes.find((x) => x.meetingId === m.id);
    if (n?.founderSubmittedAt) notesComplete++;
    if (n?.mentorSubmittedAt) notesComplete++;
  }

  let health: Health = "healthy";
  let signal = "Meeting and writing it up";

  // A pair that has never met counts from the day they were matched, so a
  // brand-new pairing starts healthy instead of looking years overdue, and a
  // matched pair that never books anything still surfaces on the same clock.
  const sinceMatched = Math.floor((now.getTime() - new Date(pairing.createdAt).getTime()) / dayMs);
  const unbookedDays = next ? 0 : lastMetDaysAgo ?? Math.max(0, sinceMatched);
  const noMeetingLabel = last ? "No next meeting" : "Matched, no first meeting booked";
  if (!next && unbookedDays >= 14) {
    health = "attention";
    signal = `${noMeetingLabel}, day ${unbookedDays}`;
  } else if (!next && unbookedDays >= 7) {
    health = "watch";
    signal = `${noMeetingLabel}, day ${unbookedDays} of 14`;
  } else if (!last) {
    signal = next ? "First meeting booked" : "Just matched, nothing booked yet";
  }

  // Drift from their own rhythm. Measured to the next meeting when one is
  // booked, because a pair who meets every two weeks and has just scheduled
  // six weeks out has slipped, even though nothing is overdue today.
  const rhythmDays = meetingRhythmDays(meetings);
  if (health === "healthy" && rhythmDays !== null && last) {
    const grace = graceDays(rhythmDays);
    const lastAt = new Date(last.scheduledAt).getTime();
    const gapDays = Math.floor(
      ((next ? new Date(next.scheduledAt).getTime() : now.getTime()) - lastAt) / dayMs
    );
    if (gapDays > rhythmDays + grace) {
      health = "watch";
      signal = next
        ? `${gapDays} days between meetings, longer than their usual ${rhythmDays}`
        : `${gapDays} days since they met, longer than their usual ${rhythmDays}`;
    }
  }

  if (health === "healthy" && notesExpected > notesComplete) {
    health = "watch";
    signal = "Meeting note incomplete";
  }

  // Appended to any pair already flagged, not only the red ones: the silence
  // is most useful when deciding whether a watch pair is actually drifting.
  // A pair with no messages at all is skipped — silence is measured from a
  // real message, not invented for a thread that never started.
  const lastMsg = messages[messages.length - 1];
  const silentDays = lastMsg
    ? Math.floor((now.getTime() - new Date(lastMsg.createdAt).getTime()) / dayMs)
    : null;
  if (health !== "healthy" && silentDays !== null && silentDays >= 10) {
    signal += `, silent thread for ${silentDays} days`;
  }

  return {
    pairing, founder, mentor, health, lastMetDaysAgo,
    nextMeeting: next, notesComplete, notesExpected, signal, rhythmDays,
  };
}

export function healthRank(h: Health): number {
  return { attention: 0, watch: 1, healthy: 2 }[h];
}
