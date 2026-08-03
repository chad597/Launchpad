// Demo-mode data layer: an in-memory store seeded from fixtures, shared across
// requests via globalThis so mutations persist for the life of the server.
// When the Launchpad Supabase project exists, this module is the seam to swap:
// keep the exported function signatures and re-implement them with queries.
import {
  actionItems, cohorts, DEMO_TODAY, flags, matchSuggestions, meetingNotes,
  meetings, messages, pairings, users,
} from "./fixtures";
import type {
  ActionItem, Flag, Health, MatchSuggestion, Meeting, MeetingNote, MentorSection,
  Message, PairHealth, Pairing, User,
} from "./types";

interface Store {
  users: User[];
  pairings: Pairing[];
  meetings: Meeting[];
  notes: MeetingNote[];
  actionItems: ActionItem[];
  messages: Message[];
  flags: Flag[];
  suggestions: MatchSuggestion[];
}

const g = globalThis as unknown as { __mentorStore?: Store };

function store(): Store {
  if (!g.__mentorStore) {
    g.__mentorStore = {
      users: structuredClone(users),
      pairings: structuredClone(pairings),
      meetings: structuredClone(meetings),
      notes: structuredClone(meetingNotes),
      actionItems: structuredClone(actionItems),
      messages: structuredClone(messages),
      flags: structuredClone(flags),
      suggestions: structuredClone(matchSuggestions),
    };
  }
  return g.__mentorStore;
}

export function now(): Date {
  return new Date(DEMO_TODAY);
}

export function getUser(id: string): User | undefined {
  return store().users.find((u) => u.id === id);
}

export function getUsersByRole(role: User["role"]): User[] {
  return store().users.filter((u) => u.role === role);
}

export function getCohort() {
  return cohorts[0];
}

export function weekNumber(): number {
  const start = new Date(getCohort().startDate + "T00:00:00.000Z").getTime();
  return Math.floor((now().getTime() - start) / (7 * 24 * 3600 * 1000)) + 1;
}

export function pairingsForUser(userId: string): Pairing[] {
  return store().pairings.filter(
    (p) => p.status === "active" && (p.founderId === userId || p.mentorId === userId)
  );
}

export function getPairing(id: string): Pairing | undefined {
  return store().pairings.find((p) => p.id === id);
}

export function meetingsForPairing(pairingId: string): Meeting[] {
  return store()
    .meetings.filter((m) => m.pairingId === pairingId)
    .sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
}

export function getMeeting(id: string): Meeting | undefined {
  return store().meetings.find((m) => m.id === id);
}

export function noteForMeeting(meetingId: string): MeetingNote | undefined {
  return store().notes.find((n) => n.meetingId === meetingId);
}

export function actionItemsForPairing(pairingId: string): ActionItem[] {
  return store().actionItems.filter((a) => a.pairingId === pairingId);
}

export function messagesForPairing(pairingId: string): Message[] {
  return store()
    .messages.filter((m) => m.pairingId === pairingId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function openFlags(): Flag[] {
  return store().flags.filter((f) => f.status === "open");
}

export function suggestionsForFounder(founderId: string): MatchSuggestion[] {
  return store()
    .suggestions.filter((s) => s.founderId === founderId && s.status === "suggested")
    .sort((a, b) => b.score - a.score);
}

export function nextMeetingForPairing(pairingId: string): Meeting | null {
  const t = now().toISOString();
  return (
    meetingsForPairing(pairingId).find(
      (m) => m.status === "scheduled" && m.scheduledAt >= t
    ) ?? null
  );
}

export function lastCompletedMeeting(pairingId: string): Meeting | null {
  const done = meetingsForPairing(pairingId).filter((m) => m.status === "completed");
  return done.length ? done[done.length - 1] : null;
}

const CADENCE_DAYS: Record<Pairing["declaredCadence"], number | null> = {
  weekly: 7, biweekly: 14, monthly: 30, as_needed: null,
};

// Health per spec §6: no-next-meeting is the strongest signal (yellow at 7
// days unbooked, red at 14), then cadence adherence, then note compliance.
export function pairHealth(pairing: Pairing): PairHealth {
  const founder = getUser(pairing.founderId)!;
  const mentor = getUser(pairing.mentorId)!;
  const next = nextMeetingForPairing(pairing.id);
  const last = lastCompletedMeeting(pairing.id);
  const dayMs = 24 * 3600 * 1000;
  const lastMetDaysAgo = last
    ? Math.floor((now().getTime() - new Date(last.scheduledAt).getTime()) / dayMs)
    : null;

  const completed = meetingsForPairing(pairing.id).filter((m) => m.status === "completed");
  const notesExpected = completed.length * 2;
  let notesComplete = 0;
  for (const m of completed) {
    const n = noteForMeeting(m.id);
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

  const lastMsg = messagesForPairing(pairing.id).at(-1);
  const silentDays = lastMsg
    ? Math.floor((now().getTime() - new Date(lastMsg.createdAt).getTime()) / dayMs)
    : 99;
  if (health === "attention" && silentDays >= 10) {
    signal += `, silent thread for ${silentDays} days`;
  }

  return { pairing, founder, mentor, health, lastMetDaysAgo, nextMeeting: next, notesComplete, notesExpected, signal };
}

export function cohortHealthBoard(): PairHealth[] {
  const rank: Record<Health, number> = { attention: 0, watch: 1, healthy: 2 };
  return store()
    .pairings.filter((p) => p.status === "active")
    .map(pairHealth)
    .sort((a, b) => rank[a.health] - rank[b.health]);
}

// ---- mutations (demo) ----

export function sendMessage(pairingId: string, senderId: string, body: string) {
  store().messages.push({
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    pairingId, senderId, body, createdAt: new Date().toISOString(),
  });
}

export function submitMentorHalf(
  meetingId: string,
  section: MentorSection,
  outcomes: { keyInsight: string; decisionMade: string; actions: { description: string; ownerId: string; dueDate: string }[] }
) {
  const s = store();
  const note = s.notes.find((n) => n.meetingId === meetingId);
  const meeting = s.meetings.find((m) => m.id === meetingId);
  if (!note || !meeting) return;
  note.mentorSection = section;
  note.keyInsight = outcomes.keyInsight || null;
  note.decisionMade = outcomes.decisionMade || null;
  note.mentorSubmittedAt = new Date().toISOString();
  meeting.status = "completed";
  for (const a of outcomes.actions) {
    if (!a.description.trim()) continue;
    s.actionItems.push({
      id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      meetingId, pairingId: meeting.pairingId,
      description: a.description, ownerId: a.ownerId, dueDate: a.dueDate, status: "open",
    });
  }
}

export function toggleActionItem(id: string) {
  const a = store().actionItems.find((x) => x.id === id);
  if (a) a.status = a.status === "done" ? "open" : "done";
}

export function resolveFlag(id: string) {
  const f = store().flags.find((x) => x.id === id);
  if (f) f.status = "resolved";
}

export function confirmMatch(suggestionId: string) {
  const s = store();
  const sug = s.suggestions.find((x) => x.id === suggestionId);
  if (!sug) return;
  sug.status = "selected";
  for (const other of s.suggestions) {
    if (other.founderId === sug.founderId && other.id !== sug.id) other.status = "rejected";
  }
  const old = s.pairings.find((p) => p.founderId === sug.founderId && p.status === "active");
  if (old) {
    old.status = "dissolved";
  }
  s.pairings.push({
    id: `p-${Date.now()}`,
    cohortId: getCohort().id,
    founderId: sug.founderId,
    mentorId: sug.mentorId,
    status: "active",
    declaredCadence: "biweekly",
    matchRationale: sug.rationale,
  });
}
