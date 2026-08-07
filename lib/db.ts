// Supabase implementation of the data layer. Queries run as the signed-in
// user, so row-level security (supabase/migrations/0001_init.sql) is the
// authorization layer; this file just maps rows to app types.
import { supabaseServer } from "./supabase/server";
import { computePairHealth, healthRank } from "./health";
import type {
  ActionItem, AuditEntry, Cohort, Flag, FounderSection, MatchSuggestion, Meeting,
  MeetingNote, MentorSection, Message, PairHealth, Pairing, StatusFlag, User,
} from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

function mapUser(r: any): User {
  return {
    id: r.id, email: r.email, name: r.name, role: r.role,
    company: r.company ?? undefined, stage: r.stage ?? undefined,
    bio: r.bio ?? undefined, expertise: r.expertise ?? undefined,
    availability: r.availability ?? undefined, bookingLink: r.booking_link ?? undefined,
    capacity: r.capacity ?? undefined, status: r.status ?? "active",
    passwordSetAt: r.password_set_at ?? undefined,

    phone: r.phone ?? undefined, title: r.title ?? undefined,
    linkedin: r.linkedin ?? undefined, website: r.website ?? undefined,
    timeZone: r.time_zone ?? undefined,
    industries: r.industries ?? undefined,
    mentoringFormat: r.mentoring_format ?? undefined,

    yearsExperience: r.years_experience ?? undefined,
    background: r.background ?? undefined,
    skills: asList(r.skills), avoidSkills: r.avoid_skills ?? undefined,
    story: r.story ?? undefined, tracks: r.tracks ?? undefined,
    stagePreference: r.stage_preference ?? undefined,
    conflicts: r.conflicts ?? undefined,
    mentorMotivation: r.mentor_motivation ?? undefined,

    founderStage: r.founder_stage ?? undefined,
    teamShape: r.team_shape ?? undefined,
    timeCommitment: r.time_commitment ?? undefined,
    needs: asList(r.needs), strengths: r.strengths ?? undefined,
    challenge: r.challenge ?? undefined, goal: r.goal ?? undefined,
    industryPref: r.industry_pref ?? undefined,
  };
}

// skills and needs are jsonb, so an unanswered question can arrive as null,
// as [], or as something else entirely. Undefined means unanswered, which the
// match report reports as unknown rather than scoring as zero.
function asList(v: any): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.map((x) => String(x));
}

function mapPairing(r: any): Pairing {
  return {
    id: r.id, cohortId: r.cohort_id, founderId: r.founder_id, mentorId: r.mentor_id,
    status: r.status, declaredCadence: r.declared_cadence ?? "as_needed",
    matchRationale: r.match_rationale ?? "",
    createdAt: r.created_at,
  };
}

function mapMeeting(r: any): Meeting {
  return {
    id: r.id, pairingId: r.pairing_id, scheduledAt: r.scheduled_at,
    status: r.status, weekNumber: r.week_number ?? 0,
  };
}

function mapNote(r: any): MeetingNote {
  return {
    id: r.id, meetingId: r.meeting_id, statusFlag: r.status_flag,
    confidence: r.confidence, founderSection: r.founder_section,
    mentorSection: r.mentor_section, keyInsight: r.key_insight,
    decisionMade: r.decision_made, founderSubmittedAt: r.founder_submitted_at,
    mentorSubmittedAt: r.mentor_submitted_at,
  };
}

function mapItem(r: any): ActionItem {
  return {
    id: r.id, meetingId: r.meeting_id, pairingId: r.pairing_id,
    description: r.description, ownerId: r.owner_id,
    dueDate: r.due_date ?? "", status: r.status,
  };
}

function mapMessage(r: any): Message {
  return { id: r.id, pairingId: r.pairing_id, senderId: r.sender_id, body: r.body, createdAt: r.created_at };
}

function mapFlag(r: any): Flag {
  return {
    id: r.id, raisedById: r.raised_by, pairingId: r.pairing_id,
    category: r.category, body: r.body, status: r.status, createdAt: r.created_at,
  };
}

function mapSuggestion(r: any): MatchSuggestion {
  return {
    id: r.id, founderId: r.founder_id, mentorId: r.mentor_id, score: Number(r.score),
    breakdown: r.breakdown ?? [], rationale: r.rationale ?? "", status: r.status,
  };
}

export async function getUserByAuth(): Promise<User | null> {
  const sb = await supabaseServer();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return null;
  const { data } = await sb.from("users").select("*").eq("auth_user_id", user.id).maybeSingle();
  return data ? mapUser(data) : null;
}

export async function getUser(id: string): Promise<User | undefined> {
  const sb = await supabaseServer();
  const { data } = await sb.from("users").select("*").eq("id", id).maybeSingle();
  return data ? mapUser(data) : undefined;
}

export async function getCohort(): Promise<Cohort> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("cohorts").select("*, ecosystems(name)")
    .eq("status", "active").order("start_date", { ascending: false }).limit(1).maybeSingle();
  if (!data) return { id: "none", ecosystem: "Launchpad", name: "No active cohort", startDate: new Date().toISOString().slice(0, 10), status: "intake" };
  return {
    id: data.id, ecosystem: (data.ecosystems as any)?.name ?? "Launchpad",
    name: data.name, startDate: data.start_date, status: data.status,
  };
}

export async function weekNumber(): Promise<number> {
  const c = await getCohort();
  const start = new Date(c.startDate + "T00:00:00.000Z").getTime();
  return Math.floor((Date.now() - start) / (7 * 24 * 3600 * 1000)) + 1;
}

export async function pairingsForUser(userId: string): Promise<Pairing[]> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("pairings").select("*").eq("status", "active")
    .or(`founder_id.eq.${userId},mentor_id.eq.${userId}`);
  return (data ?? []).map(mapPairing);
}

export async function getPairing(id: string): Promise<Pairing | undefined> {
  const sb = await supabaseServer();
  const { data } = await sb.from("pairings").select("*").eq("id", id).maybeSingle();
  return data ? mapPairing(data) : undefined;
}

export async function meetingsForPairing(pairingId: string): Promise<Meeting[]> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("meetings").select("*").eq("pairing_id", pairingId)
    .order("scheduled_at", { ascending: true });
  return (data ?? []).map(mapMeeting);
}

export async function getMeeting(id: string): Promise<Meeting | undefined> {
  const sb = await supabaseServer();
  const { data } = await sb.from("meetings").select("*").eq("id", id).maybeSingle();
  return data ? mapMeeting(data) : undefined;
}

export async function noteForMeeting(meetingId: string): Promise<MeetingNote | undefined> {
  const sb = await supabaseServer();
  const { data } = await sb.from("meeting_notes").select("*").eq("meeting_id", meetingId).maybeSingle();
  return data ? mapNote(data) : undefined;
}

export async function actionItemsForPairing(pairingId: string): Promise<ActionItem[]> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("action_items").select("*").eq("pairing_id", pairingId)
    .order("created_at", { ascending: true });
  return (data ?? []).map(mapItem);
}

export async function messagesForPairing(pairingId: string): Promise<Message[]> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("messages").select("*").eq("pairing_id", pairingId)
    .order("created_at", { ascending: true });
  return (data ?? []).map(mapMessage);
}

export async function openFlags(): Promise<Flag[]> {
  const sb = await supabaseServer();
  const { data } = await sb.from("flags").select("*").eq("status", "open").order("created_at");
  return (data ?? []).map(mapFlag);
}

export async function suggestionsForFounder(founderId: string): Promise<MatchSuggestion[]> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("match_suggestions").select("*")
    .eq("founder_id", founderId).eq("status", "suggested")
    .order("score", { ascending: false });
  return (data ?? []).map(mapSuggestion);
}

export async function nextMeetingForPairing(pairingId: string): Promise<Meeting | null> {
  const all = await meetingsForPairing(pairingId);
  const t = new Date().toISOString();
  return all.find((m) => m.status === "scheduled" && m.scheduledAt >= t) ?? null;
}

export async function lastCompletedMeeting(pairingId: string): Promise<Meeting | null> {
  const all = await meetingsForPairing(pairingId);
  const done = all.filter((m) => m.status === "completed");
  return done.length ? done[done.length - 1] : null;
}

export async function cohortHealthBoard(): Promise<PairHealth[]> {
  const sb = await supabaseServer();
  const cohort = await getCohort();
  const { data: pairRows } = await sb
    .from("pairings").select("*").eq("status", "active").eq("cohort_id", cohort.id);
  const pairs = (pairRows ?? []).map(mapPairing);
  if (!pairs.length) return [];

  const pairIds = pairs.map((p) => p.id);
  const userIds = [...new Set(pairs.flatMap((p) => [p.founderId, p.mentorId]))];
  const [{ data: userRows }, { data: meetingRows }, { data: msgRows }] = await Promise.all([
    sb.from("users").select("*").in("id", userIds),
    sb.from("meetings").select("*").in("pairing_id", pairIds).order("scheduled_at"),
    sb.from("messages").select("*").in("pairing_id", pairIds).order("created_at"),
  ]);
  const meetingIds = (meetingRows ?? []).map((m: any) => m.id);
  const { data: noteRows } = meetingIds.length
    ? await sb.from("meeting_notes").select("*").in("meeting_id", meetingIds)
    : { data: [] as any[] };

  const users = new Map((userRows ?? []).map((r: any) => [r.id, mapUser(r)]));
  const now = new Date();
  return pairs
    .map((p) =>
      computePairHealth({
        pairing: p,
        founder: users.get(p.founderId)!,
        mentor: users.get(p.mentorId)!,
        meetings: (meetingRows ?? []).filter((m: any) => m.pairing_id === p.id).map(mapMeeting),
        notes: (noteRows ?? []).map(mapNote),
        messages: (msgRows ?? []).filter((m: any) => m.pairing_id === p.id).map(mapMessage),
        now,
      })
    )
    .sort((a, b) => healthRank(a.health) - healthRank(b.health));
}

// ---- mutations (RLS enforces who may do what) ----

export async function sendMessage(pairingId: string, senderId: string, body: string) {
  const sb = await supabaseServer();
  await sb.from("messages").insert({ pairing_id: pairingId, sender_id: senderId, body });
}

export async function submitMentorHalf(
  meetingId: string,
  section: MentorSection,
  outcomes: { keyInsight: string; decisionMade: string; actions: { description: string; ownerId: string; dueDate: string }[] }
) {
  const sb = await supabaseServer();
  const meeting = await getMeeting(meetingId);
  if (!meeting) return;
  await sb.from("meeting_notes").upsert(
    {
      meeting_id: meetingId,
      mentor_section: section,
      key_insight: outcomes.keyInsight || null,
      decision_made: outcomes.decisionMade || null,
      mentor_submitted_at: new Date().toISOString(),
    },
    { onConflict: "meeting_id" }
  );
  await sb.from("meetings").update({ status: "completed" }).eq("id", meetingId);
  const rows = outcomes.actions
    .filter((a) => a.description.trim())
    .map((a) => ({
      meeting_id: meetingId, pairing_id: meeting.pairingId,
      description: a.description, owner_id: a.ownerId, due_date: a.dueDate || null,
    }));
  if (rows.length) await sb.from("action_items").insert(rows);
}

export async function submitFounderHalf(
  meetingId: string,
  section: FounderSection,
  statusFlag: StatusFlag,
  confidence: number
) {
  const sb = await supabaseServer();
  await sb.from("meeting_notes").upsert(
    {
      meeting_id: meetingId,
      founder_section: section,
      status_flag: statusFlag,
      confidence,
      founder_submitted_at: new Date().toISOString(),
    },
    { onConflict: "meeting_id" }
  );
}

export async function createMeeting(pairingId: string, scheduledAt: string, weekNo: number) {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("meetings")
    .insert({ pairing_id: pairingId, scheduled_at: scheduledAt, status: "scheduled", week_number: weekNo })
    .select("id")
    .maybeSingle();
  return data?.id ?? "";
}

export async function raiseFlag(
  raisedById: string,
  pairingId: string | null,
  category: Flag["category"],
  body: string
) {
  const sb = await supabaseServer();
  await sb.from("flags").insert({
    raised_by: raisedById, pairing_id: pairingId, category, body, status: "open",
  });
}

export async function setAvailability(userId: string, availability: string, capacity: number) {
  const sb = await supabaseServer();
  await sb.from("users").update({ availability, capacity }).eq("id", userId);
}

// ---- admin ----

export async function listUsers(): Promise<User[]> {
  const sb = await supabaseServer();
  const { data } = await sb.from("users").select("*").order("role").order("name");
  return (data ?? []).map(mapUser);
}

export async function createUser(u: Omit<User, "id">): Promise<string> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("users")
    .insert({
      email: u.email, name: u.name, role: u.role,
      company: u.company ?? null, stage: u.stage ?? null, bio: u.bio ?? null,
      expertise: u.expertise ?? null, invited_at: new Date().toISOString(),
    })
    .select("id")
    .maybeSingle();
  return data?.id ?? "";
}

export async function updateUserRole(id: string, role: User["role"]) {
  const sb = await supabaseServer();
  await sb.from("users").update({ role }).eq("id", id);
}

export async function setUserStatus(id: string, status: "active" | "inactive") {
  const sb = await supabaseServer();
  await sb.from("users").update({ status }).eq("id", id);
}

export async function cohortMembers(cohortId: string): Promise<string[]> {
  const sb = await supabaseServer();
  const { data } = await sb.from("cohort_members").select("user_id").eq("cohort_id", cohortId);
  return (data ?? []).map((r: any) => r.user_id);
}

export async function addCohortMembers(cohortId: string, userIds: string[]) {
  if (!userIds.length) return;
  const sb = await supabaseServer();
  await sb.from("cohort_members")
    .upsert(userIds.map((user_id) => ({ cohort_id: cohortId, user_id })), { onConflict: "cohort_id,user_id" });
}

export async function addToMentorPool(cohortId: string, mentorIds: string[]) {
  if (!mentorIds.length) return;
  const sb = await supabaseServer();
  await sb.from("cohort_mentor_pool")
    .upsert(mentorIds.map((mentor_id) => ({ cohort_id: cohortId, mentor_id })), { onConflict: "cohort_id,mentor_id" });
}

export async function listCohorts(): Promise<Cohort[]> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("cohorts").select("*, ecosystems(name)").order("start_date", { ascending: false });
  return (data ?? []).map((r: any) => ({
    id: r.id, ecosystem: r.ecosystems?.name ?? "Launchpad",
    name: r.name, startDate: r.start_date, status: r.status,
  }));
}

export async function createCohort(c: Omit<Cohort, "id">): Promise<string> {
  const sb = await supabaseServer();
  let { data: eco } = await sb.from("ecosystems").select("id").eq("name", c.ecosystem).maybeSingle();
  if (!eco) {
    const { data: created } = await sb.from("ecosystems").insert({ name: c.ecosystem }).select("id").maybeSingle();
    eco = created;
  }
  const { data } = await sb
    .from("cohorts")
    .insert({ ecosystem_id: eco?.id, name: c.name, start_date: c.startDate, status: c.status })
    .select("id")
    .maybeSingle();
  return data?.id ?? "";
}

export async function setCohortStatus(id: string, status: Cohort["status"]) {
  const sb = await supabaseServer();
  await sb.from("cohorts").update({ status }).eq("id", id);
}

export async function mentorPool(cohortId: string): Promise<string[]> {
  const sb = await supabaseServer();
  const { data } = await sb.from("cohort_mentor_pool").select("mentor_id").eq("cohort_id", cohortId);
  return (data ?? []).map((r: any) => r.mentor_id);
}

export async function setMentorPool(cohortId: string, mentorIds: string[]) {
  const sb = await supabaseServer();
  await sb.from("cohort_mentor_pool").delete().eq("cohort_id", cohortId);
  if (mentorIds.length) {
    await sb.from("cohort_mentor_pool").insert(
      mentorIds.map((mentor_id) => ({ cohort_id: cohortId, mentor_id }))
    );
  }
}

export async function listPairings(cohortId: string): Promise<Pairing[]> {
  const sb = await supabaseServer();
  const { data } = await sb.from("pairings").select("*").eq("cohort_id", cohortId);
  return (data ?? []).map(mapPairing);
}

export async function createPairing(
  cohortId: string, founderId: string, mentorId: string,
  cadence: Pairing["declaredCadence"], rationale: string
) {
  const sb = await supabaseServer();
  await sb.from("pairings").insert({
    cohort_id: cohortId, founder_id: founderId, mentor_id: mentorId,
    status: "active", declared_cadence: cadence, match_rationale: rationale,
    started_at: new Date().toISOString(),
  });
}

export async function updatePairing(
  id: string, changes: { status?: Pairing["status"]; declaredCadence?: Pairing["declaredCadence"] }
) {
  const sb = await supabaseServer();
  const patch: Record<string, unknown> = {};
  if (changes.status) {
    patch.status = changes.status;
    if (changes.status === "dissolved" || changes.status === "completed") {
      patch.ended_at = new Date().toISOString();
    }
  }
  if (changes.declaredCadence) patch.declared_cadence = changes.declaredCadence;
  if (Object.keys(patch).length) await sb.from("pairings").update(patch).eq("id", id);
}

export async function writeAudit(e: Omit<AuditEntry, "id" | "createdAt">) {
  const sb = await supabaseServer();
  await sb.from("audit_log").insert({
    actor_id: e.actorId, action: e.action, subject_type: e.subjectType,
    subject_id: e.subjectId, metadata: e.metadata,
  });
}

export async function listAudit(limit = 100): Promise<AuditEntry[]> {
  const sb = await supabaseServer();
  const { data } = await sb
    .from("audit_log").select("*, users!audit_log_actor_id_fkey(name)")
    .order("created_at", { ascending: false }).limit(limit);
  return (data ?? []).map((r: any) => ({
    id: String(r.id), actorId: r.actor_id, actorName: r.users?.name,
    action: r.action, subjectType: r.subject_type, subjectId: r.subject_id,
    metadata: r.metadata ?? {}, createdAt: r.created_at,
  }));
}

export async function toggleActionItem(id: string) {
  const sb = await supabaseServer();
  const { data } = await sb.from("action_items").select("status").eq("id", id).maybeSingle();
  if (!data) return;
  const done = data.status === "done";
  await sb.from("action_items").update({
    status: done ? "open" : "done",
    completed_at: done ? null : new Date().toISOString(),
  }).eq("id", id);
}

export async function resolveFlag(id: string) {
  const sb = await supabaseServer();
  await sb.from("flags").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", id);
}

// Returns the pairing it created, so the caller introduces the right two people.
export async function confirmMatch(suggestionId: string): Promise<Pairing | null> {
  const sb = await supabaseServer();
  const { data: sugRow } = await sb.from("match_suggestions").select("*").eq("id", suggestionId).maybeSingle();
  if (!sugRow) return null;
  const sug = mapSuggestion(sugRow);
  const cohort = await getCohort();
  await sb.from("match_suggestions").update({ status: "selected" }).eq("id", suggestionId);
  await sb.from("match_suggestions").update({ status: "rejected" })
    .eq("founder_id", sug.founderId).neq("id", suggestionId).eq("status", "suggested");

  // Dissolve the pairing this replaces, but never a legitimate second mentor.
  const { data: current } = await sb
    .from("pairings").select("id").eq("founder_id", sug.founderId).eq("status", "active");
  if ((current ?? []).length === 1) {
    await sb.from("pairings")
      .update({ status: "dissolved", ended_at: new Date().toISOString(), end_reason: "rematched" })
      .eq("id", current![0].id);
  }

  const { data: created } = await sb.from("pairings").insert({
    cohort_id: cohort.id, founder_id: sug.founderId, mentor_id: sug.mentorId,
    status: "active", declared_cadence: "biweekly", match_rationale: sug.rationale,
    started_at: new Date().toISOString(),
  }).select("*").maybeSingle();
  return created ? mapPairing(created) : null;
}
