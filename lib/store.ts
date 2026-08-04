// Demo-mode data layer: an in-memory store seeded from fixtures, shared across
// requests via globalThis so mutations persist for the life of the server.
// When the Launchpad Supabase project exists, this module is the seam to swap:
// keep the exported function signatures and re-implement them with queries.
import {
  actionItems, cohorts, DEMO_TODAY, flags, matchSuggestions, meetingNotes,
  meetings, messages, pairings, users,
} from "./fixtures";
import { computePairHealth, healthRank } from "./health";
import type {
  ActionItem, AuditEntry, Cohort, Flag, FounderSection, MatchSuggestion, Meeting,
  MeetingNote, MentorSection, Message, PairHealth, Pairing, StatusFlag, User,
} from "./types";

interface Store {
  users: User[];
  cohorts: Cohort[];
  pool: { cohortId: string; mentorId: string }[];
  members: { cohortId: string; userId: string }[];
  pairings: Pairing[];
  meetings: Meeting[];
  notes: MeetingNote[];
  actionItems: ActionItem[];
  messages: Message[];
  flags: Flag[];
  suggestions: MatchSuggestion[];
  audit: AuditEntry[];
}

const g = globalThis as unknown as { __mentorStore?: Store };

function store(): Store {
  if (!g.__mentorStore) {
    g.__mentorStore = {
      users: structuredClone(users).map((u) => ({ ...u, status: "active" as const })),
      cohorts: structuredClone(cohorts),
      pool: structuredClone(users)
        .filter((u) => u.role === "mentor")
        .map((u) => ({ cohortId: cohorts[0].id, mentorId: u.id })),
      members: structuredClone(users)
        .filter((u) => u.role === "founder")
        .map((u) => ({ cohortId: cohorts[0].id, userId: u.id })),
      audit: [],
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
  return store().cohorts.find((c) => c.status === "active") ?? store().cohorts[0];
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

// Health scoring lives in lib/health.ts, shared with the Supabase layer.
export function pairHealth(pairing: Pairing): PairHealth {
  return computePairHealth({
    pairing,
    founder: getUser(pairing.founderId)!,
    mentor: getUser(pairing.mentorId)!,
    meetings: meetingsForPairing(pairing.id),
    notes: store().notes,
    messages: messagesForPairing(pairing.id),
    now: now(),
  });
}

export function cohortHealthBoard(): PairHealth[] {
  return store()
    .pairings.filter((p) => p.status === "active")
    .map(pairHealth)
    .sort((a, b) => healthRank(a.health) - healthRank(b.health));
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

export function submitFounderHalf(
  meetingId: string,
  section: FounderSection,
  statusFlag: StatusFlag,
  confidence: number
) {
  const s = store();
  let note = s.notes.find((n) => n.meetingId === meetingId);
  if (!note) {
    note = {
      id: `n-${Date.now()}`, meetingId, statusFlag: null, confidence: null,
      founderSection: null, mentorSection: null, keyInsight: null,
      decisionMade: null, founderSubmittedAt: null, mentorSubmittedAt: null,
    };
    s.notes.push(note);
  }
  note.founderSection = section;
  note.statusFlag = statusFlag;
  note.confidence = confidence;
  note.founderSubmittedAt = new Date().toISOString();
}

export function createMeeting(pairingId: string, scheduledAt: string, weekNo: number) {
  const id = `m-${Date.now()}`;
  store().meetings.push({ id, pairingId, scheduledAt, status: "scheduled", weekNumber: weekNo });
  return id;
}

export function raiseFlag(
  raisedById: string,
  pairingId: string | null,
  category: Flag["category"],
  body: string
) {
  store().flags.push({
    id: `f-${Date.now()}`, raisedById, pairingId, category, body,
    status: "open", createdAt: new Date().toISOString(),
  });
}

export function setAvailability(userId: string, availability: string, capacity: number) {
  const u = store().users.find((x) => x.id === userId);
  if (u) { u.availability = availability; u.capacity = capacity; }
}

// ---- admin ----

export function listUsers(): User[] {
  const order = { admin: 0, instructor: 1, mentor: 2, founder: 3 };
  return [...store().users].sort(
    (a, b) => order[a.role] - order[b.role] || a.name.localeCompare(b.name)
  );
}

export function createUser(u: Omit<User, "id">): string {
  const id = `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  store().users.push({ ...u, id, status: "active" });
  return id;
}

export function updateUserRole(id: string, role: User["role"]) {
  const u = store().users.find((x) => x.id === id);
  if (u) u.role = role;
}

export function setUserStatus(id: string, status: "active" | "inactive") {
  const u = store().users.find((x) => x.id === id);
  if (u) u.status = status;
}

export function cohortMembers(cohortId: string): string[] {
  return store().members.filter((m) => m.cohortId === cohortId).map((m) => m.userId);
}

export function addCohortMembers(cohortId: string, userIds: string[]) {
  const s = store();
  for (const userId of userIds) {
    if (!s.members.some((m) => m.cohortId === cohortId && m.userId === userId)) {
      s.members.push({ cohortId, userId });
    }
  }
}

export function addToMentorPool(cohortId: string, mentorIds: string[]) {
  const s = store();
  for (const mentorId of mentorIds) {
    if (!s.pool.some((p) => p.cohortId === cohortId && p.mentorId === mentorId)) {
      s.pool.push({ cohortId, mentorId });
    }
  }
}

export function listCohorts(): Cohort[] {
  return [...store().cohorts].sort((a, b) => b.startDate.localeCompare(a.startDate));
}

export function createCohort(c: Omit<Cohort, "id">): string {
  const id = `c-${Date.now()}`;
  store().cohorts.push({ ...c, id });
  return id;
}

export function setCohortStatus(id: string, status: Cohort["status"]) {
  const c = store().cohorts.find((x) => x.id === id);
  if (c) c.status = status;
}

export function mentorPool(cohortId: string): string[] {
  return store().pool.filter((p) => p.cohortId === cohortId).map((p) => p.mentorId);
}

export function setMentorPool(cohortId: string, mentorIds: string[]) {
  const s = store();
  s.pool = s.pool.filter((p) => p.cohortId !== cohortId);
  for (const mentorId of mentorIds) s.pool.push({ cohortId, mentorId });
}

export function listPairings(cohortId: string): Pairing[] {
  return store().pairings.filter((p) => p.cohortId === cohortId);
}

export function createPairing(
  cohortId: string, founderId: string, mentorId: string,
  cadence: Pairing["declaredCadence"], rationale: string
) {
  store().pairings.push({
    id: `p-${Date.now()}`, cohortId, founderId, mentorId,
    status: "active", declaredCadence: cadence, matchRationale: rationale,
  });
}

export function updatePairing(
  id: string, changes: { status?: Pairing["status"]; declaredCadence?: Pairing["declaredCadence"] }
) {
  const p = store().pairings.find((x) => x.id === id);
  if (!p) return;
  if (changes.status) p.status = changes.status;
  if (changes.declaredCadence) p.declaredCadence = changes.declaredCadence;
}

export function writeAudit(e: Omit<AuditEntry, "id" | "createdAt">) {
  store().audit.unshift({
    ...e,
    id: `au-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    createdAt: new Date().toISOString(),
  });
}

export function listAudit(limit = 100): AuditEntry[] {
  const users = store().users;
  return store().audit.slice(0, limit).map((e) => ({
    ...e,
    actorName: users.find((u) => u.id === e.actorId)?.name,
  }));
}

export function toggleActionItem(id: string) {
  const a = store().actionItems.find((x) => x.id === id);
  if (a) a.status = a.status === "done" ? "open" : "done";
}

export function resolveFlag(id: string) {
  const f = store().flags.find((x) => x.id === id);
  if (f) f.status = "resolved";
}

// Returns the pairing it created, so the caller can introduce the right two
// people rather than guessing which of a founder's pairings is the new one.
export function confirmMatch(suggestionId: string): Pairing | null {
  const s = store();
  const sug = s.suggestions.find((x) => x.id === suggestionId);
  if (!sug) return null;
  sug.status = "selected";
  for (const other of s.suggestions) {
    if (other.founderId === sug.founderId && other.id !== sug.id) other.status = "rejected";
  }
  // Only the pairing this suggestion replaces is dissolved. A founder may
  // legitimately hold a second mentor, and that one is left alone.
  const replaced = s.pairings.find(
    (p) => p.founderId === sug.founderId && p.status === "active" && p.mentorId !== sug.mentorId
  );
  if (replaced && s.pairings.filter((p) => p.founderId === sug.founderId && p.status === "active").length === 1) {
    replaced.status = "dissolved";
  }
  const created: Pairing = {
    id: `p-${Date.now()}`,
    cohortId: getCohort().id,
    founderId: sug.founderId,
    mentorId: sug.mentorId,
    status: "active",
    declaredCadence: "biweekly",
    matchRationale: sug.rationale,
  };
  s.pairings.push(created);
  return created;
}
