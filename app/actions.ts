"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import * as data from "@/lib/data";
import { currentUser, homeForRole } from "@/lib/session";
import { isDemo, supabaseServer } from "@/lib/supabase/server";
import { getUser as demoGetUser } from "@/lib/store";

// ---- auth ----

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/login?error=Enter your email address");
  const sb = await supabaseServer();
  const h = await headers();
  const origin = h.get("origin") ?? h.get("x-forwarded-host") ?? "";
  const base = origin.startsWith("http") ? origin : `https://${origin}`;
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${base}/auth/callback` },
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/login?sent=1");
}

export async function signOut() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/login");
}

export async function switchIdentity(formData: FormData) {
  if (!isDemo()) redirect("/");
  const id = String(formData.get("id") ?? "u-alex");
  const jar = await cookies();
  jar.set("demo_user", id, { path: "/" });
  const user = demoGetUser(id);
  redirect(homeForRole(user?.role ?? "founder"));
}

// ---- app actions (sender identity always comes from the session) ----

export async function postMessage(formData: FormData) {
  const user = await currentUser();
  const pairingId = String(formData.get("pairingId"));
  const body = String(formData.get("body") ?? "").trim();
  const pairing = await data.getPairing(pairingId);
  if (!pairing || (pairing.founderId !== user.id && pairing.mentorId !== user.id)) return;
  if (body) await data.sendMessage(pairingId, user.id, body);
  revalidatePath(`/messages/${pairingId}`);
}

export async function completeMentorHalf(formData: FormData) {
  const user = await currentUser();
  const meetingId = String(formData.get("meetingId"));
  const meeting = await data.getMeeting(meetingId);
  if (!meeting) return;
  const pairing = await data.getPairing(meeting.pairingId);
  if (!pairing || pairing.mentorId !== user.id) return;

  const actions: { description: string; ownerId: string; dueDate: string }[] = [];
  for (let i = 0; i < 3; i++) {
    actions.push({
      description: String(formData.get(`action_${i}`) ?? ""),
      ownerId: String(formData.get(`action_owner_${i}`) ?? ""),
      dueDate: String(formData.get(`action_due_${i}`) ?? ""),
    });
  }
  await data.submitMentorHalf(
    meetingId,
    {
      read: String(formData.get("read") ?? ""),
      whatImSeeing: String(formData.get("seeing") ?? "").split("\n").filter(Boolean),
      risks: String(formData.get("risks") ?? "").split("\n").filter(Boolean),
      focusAdjustments: String(formData.get("focus") ?? "").split("\n").filter(Boolean),
      myTake: String(formData.get("take") ?? ""),
    },
    {
      keyInsight: String(formData.get("keyInsight") ?? ""),
      decisionMade: String(formData.get("decisionMade") ?? ""),
      actions,
    }
  );
  revalidatePath("/", "layout");
  redirect(`/note/${meetingId}`);
}

export async function submitFounderHalf(formData: FormData) {
  const user = await currentUser();
  const meetingId = String(formData.get("meetingId"));
  const meeting = await data.getMeeting(meetingId);
  if (!meeting) return;
  const pairing = await data.getPairing(meeting.pairingId);
  if (!pairing || pairing.founderId !== user.id) return;

  const lines = (k: string) =>
    String(formData.get(k) ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  const statusFlag = String(formData.get("statusFlag") ?? "on_track") as
    | "on_track" | "at_risk" | "off_track";
  const confidence = Math.min(10, Math.max(1, Number(formData.get("confidence") ?? 5)));

  await data.submitFounderHalf(
    meetingId,
    {
      actionItemCheckIds: formData.getAll("done").map(String),
      whatMoved: lines("whatMoved"),
      whatChangedMyThinking: String(formData.get("changedThinking") ?? ""),
      whereINeedHelp: String(formData.get("needHelp") ?? ""),
      focusNextWeek: lines("focusNextWeek"),
    },
    statusFlag,
    confidence
  );
  revalidatePath("/", "layout");
  redirect(`/note/${meetingId}`);
}

export async function bookMeeting(formData: FormData) {
  const user = await currentUser();
  const pairingId = String(formData.get("pairingId"));
  const when = String(formData.get("scheduledAt") ?? "");
  const pairing = await data.getPairing(pairingId);
  if (!pairing || (pairing.founderId !== user.id && pairing.mentorId !== user.id)) return;
  if (!when) redirect("/founder?error=Pick a date and time");

  const cohort = await data.getCohort();
  const start = new Date(cohort.startDate + "T00:00:00.000Z").getTime();
  const at = new Date(when);
  const weekNo = Math.max(1, Math.floor((at.getTime() - start) / (7 * 24 * 3600 * 1000)) + 1);
  await data.createMeeting(pairingId, at.toISOString(), weekNo);
  revalidatePath("/", "layout");
  redirect(homeForRole(user.role));
}

export async function submitFlag(formData: FormData) {
  const user = await currentUser();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) redirect("/flag?error=Tell us what is going on");
  const category = String(formData.get("category") ?? "other") as
    | "pattern_risk" | "match_not_working" | "conduct" | "other";
  const pairingId = String(formData.get("pairingId") ?? "") || null;
  await data.raiseFlag(user.id, pairingId, category, body);
  revalidatePath("/admin");
  redirect("/flag?sent=1");
}

export async function saveAvailability(formData: FormData) {
  const user = await currentUser();
  if (user.role !== "mentor") return;
  const availability = String(formData.get("availability") ?? "").trim();
  const capacity = Math.min(10, Math.max(0, Number(formData.get("capacity") ?? 1)));
  await data.setAvailability(user.id, availability, capacity);
  revalidatePath("/", "layout");
  redirect("/mentor");
}

// ---- admin ----

async function requireAdmin() {
  const user = await currentUser();
  if (user.role !== "admin") redirect("/");
  return user;
}

export async function addPerson(formData: FormData) {
  const admin = await requireAdmin();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  if (!email || !name) redirect("/admin/people?error=Name and email are both required");
  const role = String(formData.get("role") ?? "founder") as
    | "founder" | "mentor" | "instructor" | "admin";
  const expertise = String(formData.get("expertise") ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);

  const id = await data.createUser({
    email, name, role,
    company: String(formData.get("company") ?? "") || undefined,
    stage: String(formData.get("stage") ?? "") || undefined,
    bio: String(formData.get("bio") ?? "") || undefined,
    expertise: expertise.length ? expertise : undefined,
  });
  await data.writeAudit({
    actorId: admin.id, action: "person.created", subjectType: "user", subjectId: id,
    metadata: { email, role },
  });
  revalidatePath("/admin/people");
  redirect("/admin/people?added=" + encodeURIComponent(name));
}

export async function changeRole(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const role = String(formData.get("role")) as "founder" | "mentor" | "instructor" | "admin";
  const before = await data.getUser(id);
  if (!before || before.role === role) return;
  // Never let the last admin demote themselves out of the system.
  if (before.role === "admin" && role !== "admin") {
    const admins = (await data.listUsers()).filter((u) => u.role === "admin" && u.status !== "inactive");
    if (admins.length <= 1) redirect("/admin/people?error=Keep at least one admin");
  }
  await data.updateUserRole(id, role);
  await data.writeAudit({
    actorId: admin.id, action: "person.role_changed", subjectType: "user", subjectId: id,
    metadata: { from: before.role, to: role, name: before.name },
  });
  revalidatePath("/admin/people");
}

export async function changeStatus(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as "active" | "inactive";
  const before = await data.getUser(id);
  if (!before) return;
  if (id === admin.id && status === "inactive") redirect("/admin/people?error=You cannot deactivate yourself");
  await data.setUserStatus(id, status);
  await data.writeAudit({
    actorId: admin.id, action: status === "inactive" ? "person.deactivated" : "person.reactivated",
    subjectType: "user", subjectId: id, metadata: { name: before.name },
  });
  revalidatePath("/admin/people");
}

export async function addCohort(formData: FormData) {
  const admin = await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const ecosystem = String(formData.get("ecosystem") ?? "").trim();
  const startDate = String(formData.get("startDate") ?? "");
  if (!name || !ecosystem || !startDate) redirect("/admin/cohorts?error=Name, ecosystem, and start date are required");
  const id = await data.createCohort({ name, ecosystem, startDate, status: "intake" });
  await data.writeAudit({
    actorId: admin.id, action: "cohort.created", subjectType: "cohort", subjectId: id,
    metadata: { name, ecosystem, startDate },
  });
  revalidatePath("/admin/cohorts");
  redirect("/admin/cohorts");
}

export async function changeCohortStatus(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as "intake" | "active" | "completed";
  await data.setCohortStatus(id, status);
  await data.writeAudit({
    actorId: admin.id, action: "cohort.status_changed", subjectType: "cohort", subjectId: id,
    metadata: { status },
  });
  revalidatePath("/", "layout");
}

export async function saveMentorPool(formData: FormData) {
  const admin = await requireAdmin();
  const cohortId = String(formData.get("cohortId"));
  const mentorIds = formData.getAll("mentorId").map(String);
  await data.setMentorPool(cohortId, mentorIds);
  await data.writeAudit({
    actorId: admin.id, action: "cohort.pool_updated", subjectType: "cohort", subjectId: cohortId,
    metadata: { count: mentorIds.length },
  });
  revalidatePath("/admin/cohorts");
}

export async function addPairing(formData: FormData) {
  const admin = await requireAdmin();
  const cohortId = String(formData.get("cohortId"));
  const founderId = String(formData.get("founderId"));
  const mentorId = String(formData.get("mentorId"));
  if (!founderId || !mentorId) redirect("/admin/pairings?error=Pick both a founder and a mentor");
  const cadence = String(formData.get("cadence") ?? "biweekly") as
    "weekly" | "biweekly" | "monthly" | "as_needed";
  const rationale = String(formData.get("rationale") ?? "").trim();
  await data.createPairing(cohortId, founderId, mentorId, cadence, rationale);
  await data.writeAudit({
    actorId: admin.id, action: "pairing.created", subjectType: "pairing", subjectId: null,
    metadata: { founderId, mentorId, cadence },
  });
  revalidatePath("/", "layout");
  redirect("/admin/pairings");
}

export async function changePairing(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status") ?? "") as
    "" | "proposed" | "active" | "paused" | "completed" | "dissolved";
  const cadence = String(formData.get("cadence") ?? "") as
    "" | "weekly" | "biweekly" | "monthly" | "as_needed";
  await data.updatePairing(id, {
    status: status || undefined,
    declaredCadence: cadence || undefined,
  });
  await data.writeAudit({
    actorId: admin.id, action: "pairing.updated", subjectType: "pairing", subjectId: id,
    metadata: { status: status || undefined, cadence: cadence || undefined },
  });
  revalidatePath("/", "layout");
}

export async function markActionItem(formData: FormData) {
  const user = await currentUser();
  const id = String(formData.get("id"));
  const pairingId = String(formData.get("pairingId") ?? "");
  if (pairingId) {
    const pairing = await data.getPairing(pairingId);
    if (!pairing || (pairing.founderId !== user.id && pairing.mentorId !== user.id && user.role !== "admin")) return;
  }
  await data.toggleActionItem(id);
  revalidatePath("/", "layout");
}

export async function closeFlag(formData: FormData) {
  const user = await currentUser();
  if (user.role !== "admin") return;
  const id = String(formData.get("id"));
  await data.resolveFlag(id);
  await data.writeAudit({
    actorId: user.id, action: "flag.resolved", subjectType: "flag", subjectId: id, metadata: {},
  });
  revalidatePath("/admin");
}

export async function selectMatch(formData: FormData) {
  const user = await currentUser();
  if (user.role !== "admin") return;
  const id = String(formData.get("suggestionId"));
  await data.confirmMatch(id);
  await data.writeAudit({
    actorId: user.id, action: "match.confirmed", subjectType: "match_suggestion",
    subjectId: id, metadata: {},
  });
  revalidatePath("/", "layout");
}
