// Pair-health scoring per spec §6, pure so demo mode and the database share it.
// No-next-meeting is the strongest signal (yellow at 7 days unbooked, red at
// 14), then declared-cadence adherence, then note compliance.
import type { Health, Meeting, MeetingNote, Message, PairHealth, Pairing, User } from "./types";

const CADENCE_DAYS: Record<Pairing["declaredCadence"], number | null> = {
  weekly: 7, biweekly: 14, monthly: 30, as_needed: null,
};

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
  const dayMs = 24 * 3600 * 1000;
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
  let signal = "On cadence";

  const unbookedDays = next ? 0 : lastMetDaysAgo ?? 99;
  if (!next && unbookedDays >= 14) {
    health = "attention";
    signal = `No next meeting, day ${unbookedDays}`;
  } else if (!next && unbookedDays >= 7) {
    health = "watch";
    signal = `No next meeting, day ${unbookedDays} of 14`;
  }

  const cadence = CADENCE_DAYS[pairing.declaredCadence];
  if (health === "healthy" && cadence && lastMetDaysAgo !== null && lastMetDaysAgo > cadence + 4) {
    health = "watch";
    signal = `Behind declared ${pairing.declaredCadence} cadence`;
  }

  if (health === "healthy" && notesExpected > notesComplete) {
    health = "watch";
    signal = "Meeting note incomplete";
  }

  const lastMsg = messages[messages.length - 1];
  const silentDays = lastMsg
    ? Math.floor((now.getTime() - new Date(lastMsg.createdAt).getTime()) / dayMs)
    : 99;
  if (health === "attention" && silentDays >= 10) {
    signal += `, silent thread for ${silentDays} days`;
  }

  return {
    pairing, founder, mentor, health, lastMetDaysAgo,
    nextMeeting: next, notesComplete, notesExpected, signal,
  };
}

export function healthRank(h: Health): number {
  return { attention: 0, watch: 1, healthy: 2 }[h];
}
