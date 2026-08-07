"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import * as data from "@/lib/data";
import { currentUser, homeForRole } from "@/lib/session";
import { isDemo, supabaseServer } from "@/lib/supabase/server";
import { getUser as demoGetUser } from "@/lib/store";
import type { ImportRow } from "@/lib/csv";
import {
  acceptApplicant, addQuestion, deleteQuestion, getApplication, getForm, listApplications,
  moveQuestion, saveFounderBrief, saveFounderIntake, saveMentorProfile, setApplicationStatus,
  setFounderNeeds, submitApplication, updateFormCopy, updateQuestion,
} from "@/lib/forms";
import {
  emailAccepted, emailAdminNewApplication, emailApplicationReceived, emailDeclined, emailMatchIntro,
} from "@/lib/email";
import { getFormForEditing } from "@/lib/forms";
import {
  slugifyKey, type FormQuestion, type QuestionOption, type QuestionType,
} from "@/lib/mentor-form";
import type { FormState } from "@/lib/form-state";
import { issueInvite, redeemInvite } from "@/lib/invites";
import { saveWeekly, weekStartOf } from "@/lib/weekly";
import { buildShortlist } from "@/lib/matcher";
import { assembleReport, composeFallback, narrativeInput } from "@/lib/report";
import { saveNarrative } from "@/lib/report-store";
import { GEMINI_MODEL, geminiConfigured, writeNarrative } from "@/lib/gemini";

// ---- auth ----

// The app cannot depend on sending email, so sign-in is a password the person
// set through an invite link, or Google. Both are limited to people an admin
// has already added: no route here creates an account.
async function siteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = await headers();
  const origin = h.get("origin");
  if (origin?.startsWith("http")) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) redirect("/login?error=Enter your email and password");
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email, password });
  // Never say which half was wrong: that would confirm who has an account.
  if (error) redirect("/login?error=That email and password did not match");
  redirect("/");
}

export async function signInWithGoogle() {
  const sb = await supabaseServer();
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${await siteOrigin()}/auth/callback` },
  });
  if (error || !data.url) redirect("/login?error=Google sign-in is not available right now");
  redirect(data.url);
}

export async function setPasswordFromInvite(state: FormState, formData: FormData): Promise<FormState> {
  const next = state.attempt + 1;
  const token = String(formData.get("token") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const fail = (error: string) => ({ attempt: next, error });

  if (password.length < 10) return fail("Use at least 10 characters");
  if (password !== confirm) return fail("Those two passwords do not match");

  const result = await redeemInvite(token, password);
  if (!result.ok || !result.email) return fail(result.reason ?? "That link is no longer valid");

  // Sign them straight in: asking someone to retype what they just chose is
  // the kind of small friction that loses volunteer mentors.
  const sb = await supabaseServer();
  const { error } = await sb.auth.signInWithPassword({ email: result.email, password });
  if (error) redirect("/login?set=1");
  redirect("/");
}

export async function createInviteLink(formData: FormData) {
  const admin = await requireAdmin();
  const userId = String(formData.get("userId") ?? "");
  const purpose = String(formData.get("purpose") ?? "invite") === "reset" ? "reset" : "invite";
  const person = await data.getUser(userId);
  if (!person) redirect("/admin/people?error=That person is no longer here");

  const issued = await issueInvite(userId, purpose, admin.id, await siteOrigin());
  if (!issued) {
    redirect("/admin/people?error=Invite links need SUPABASE_SERVICE_ROLE_KEY to be set");
  }
  await data.writeAudit({
    actorId: admin.id, action: `person.${purpose}_link`, subjectType: "user", subjectId: userId,
    metadata: { email: person.email },
  });
  revalidatePath("/admin/people");
  redirect(`/admin/people?link=${encodeURIComponent(issued.url)}&for=${encodeURIComponent(person.name)}`);
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
  // The thread is on the home screens too, not only its own page.
  revalidatePath("/", "layout");
}

// A note can be filled in from the home screen or from its own page, so it
// returns to wherever it was submitted. Only internal paths, never a URL
// someone posted in.
function safeReturn(formData: FormData, fallback: string): string {
  const to = String(formData.get("returnTo") ?? "");
  return to.startsWith("/") && !to.startsWith("//") ? to : fallback;
}

// Everything the person typed, so a rejected note can be handed straight back.
function echo(formData: FormData, keys: string[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of keys) out[k] = String(formData.get(k) ?? "");
  return out;
}

const MENTOR_HALF_FIELDS = [
  "read", "seeing", "risks", "focus", "take", "keyInsight", "decisionMade",
  "action_0", "action_owner_0", "action_due_0",
  "action_1", "action_owner_1", "action_due_1",
  "action_2", "action_owner_2", "action_due_2",
  "nextMeetingAt",
];

export async function completeMentorHalf(
  state: FormState, formData: FormData
): Promise<FormState> {
  const next = state.attempt + 1;
  const values = echo(formData, MENTOR_HALF_FIELDS);
  const fail = (error: string) => ({ attempt: next, error, values });

  const user = await currentUser();
  const meetingId = String(formData.get("meetingId"));
  const meeting = await data.getMeeting(meetingId);
  if (!meeting) return fail("That meeting no longer exists");
  const pairing = await data.getPairing(meeting.pairingId);
  if (!pairing || pairing.mentorId !== user.id) {
    return fail("Only the mentor on this pairing can finish the note");
  }

  // Submitting closes the record for good, so the two fields that carry the
  // mentor's read have to actually be there. The browser enforces this too,
  // but the browser is not the only thing that can post here.
  const read = String(formData.get("read") ?? "").trim();
  const take = String(formData.get("take") ?? "").trim();
  const missingHalf: string[] = [];
  if (!read) missingHalf.push("your read");
  if (!take) missingHalf.push("my take");
  if (missingHalf.length) return fail(`Still needed: ${missingHalf.join(" and ")}`);

  const actions: { description: string; ownerId: string; dueDate: string }[] = [];
  for (let i = 0; i < 3; i++) {
    const description = String(formData.get(`action_${i}`) ?? "").trim();
    if (!description) continue;
    // The owner comes from a dropdown, so only the two people in this pairing
    // are ever valid. Anything else would hang an action item on a stranger.
    const owner = String(formData.get(`action_owner_${i}`) ?? "");
    const ownerId = owner === pairing.mentorId ? pairing.mentorId : pairing.founderId;
    const due = String(formData.get(`action_due_${i}`) ?? "").trim();
    // A date input sends YYYY-MM-DD. Anything else would fail the insert after
    // the note had already been marked complete.
    if (due && !/^\d{4}-\d{2}-\d{2}$/.test(due)) {
      return fail(`Action ${i + 1} needs a real due date, or none at all`);
    }
    actions.push({ description, ownerId, dueDate: due });
  }

  // Booked as part of closing the note, while they are still together.
  const nextWhen = String(formData.get("nextMeetingAt") ?? "").trim();
  if (nextWhen) {
    const bookingError = await scheduleMeeting(meeting.pairingId, nextWhen);
    if (bookingError) return fail(bookingError);
  }

  await data.submitMentorHalf(
    meetingId,
    {
      read,
      whatImSeeing: String(formData.get("seeing") ?? "").split("\n").filter(Boolean),
      risks: String(formData.get("risks") ?? "").split("\n").filter(Boolean),
      focusAdjustments: String(formData.get("focus") ?? "").split("\n").filter(Boolean),
      myTake: take,
    },
    {
      keyInsight: String(formData.get("keyInsight") ?? "").trim(),
      decisionMade: String(formData.get("decisionMade") ?? "").trim(),
      actions,
    }
  );
  revalidatePath("/", "layout");
  redirect(safeReturn(formData, `/note/${meetingId}`));
}

const FOUNDER_HALF_FIELDS = [
  "statusFlag", "confidence", "whatMoved", "changedThinking", "needHelp", "focusNextWeek",
];

export async function submitFounderHalf(
  state: FormState, formData: FormData
): Promise<FormState> {
  const next = state.attempt + 1;
  const doneIds = formData.getAll("done").map(String);
  const values = { ...echo(formData, FOUNDER_HALF_FIELDS), done: doneIds };
  const fail = (error: string) => ({ attempt: next, error, values });

  const user = await currentUser();
  const meetingId = String(formData.get("meetingId"));
  const meeting = await data.getMeeting(meetingId);
  if (!meeting) return fail("That meeting no longer exists");
  const pairing = await data.getPairing(meeting.pairingId);
  if (!pairing || pairing.founderId !== user.id) {
    return fail("Only the founder on this pairing can write this half");
  }

  const lines = (k: string) =>
    String(formData.get(k) ?? "").split("\n").map((s) => s.trim()).filter(Boolean);
  const raw = String(formData.get("statusFlag") ?? "on_track");
  const statusFlag = (["on_track", "at_risk", "off_track"].includes(raw) ? raw : "on_track") as
    "on_track" | "at_risk" | "off_track";

  const whatMoved = lines("whatMoved");
  const needHelp = String(formData.get("needHelp") ?? "").trim();
  const missing: string[] = [];
  if (!whatMoved.length) missing.push("what moved");
  if (!needHelp) missing.push("where you need help");
  if (missing.length) return fail(`Still needed: ${missing.join(" and ")}`);

  // Number("eight") is NaN, and Math.min/max propagate it rather than clamping.
  // Confidence feeds the health score, so ask rather than guess a number.
  const parsed = Number(String(formData.get("confidence") ?? "").trim());
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 10) {
    return fail("Confidence needs to be a number from 1 to 10");
  }
  const confidence = Math.round(parsed);

  await data.submitFounderHalf(
    meetingId,
    {
      actionItemCheckIds: doneIds,
      whatMoved,
      whatChangedMyThinking: String(formData.get("changedThinking") ?? "").trim(),
      whereINeedHelp: needHelp,
      focusNextWeek: lines("focusNextWeek"),
    },
    statusFlag,
    confidence
  );

  // The checkboxes are the founder saying "I did these", so they have to
  // actually move the action items, not just be recorded on the note.
  const prior = (await data.actionItemsForPairing(pairing.id))
    .filter((a) => a.meetingId !== meetingId);
  for (const item of prior) {
    const shouldBeDone = doneIds.includes(item.id);
    if (shouldBeDone !== (item.status === "done")) await data.toggleActionItem(item.id);
  }

  revalidatePath("/", "layout");
  redirect(safeReturn(formData, `/note/${meetingId}`));
}

// Booking happens in two places: the card on either home screen, and the
// close of the meeting note, where the pair is together and has just agreed
// what happens next. Both land here.
//
// Returns an error to show, or null when the meeting is booked.
async function scheduleMeeting(pairingId: string, when: string): Promise<string | null> {
  if (!when) return "Pick a date and time";

  // The picker sends a bare "2026-08-20T09:00" with no zone. Parsing that with
  // new Date() uses the server's zone, so on Vercel (UTC) a 9am booking would
  // land at 5am for everyone. Anchor it to the program's timezone instead.
  const at = new Date(`${when}:00${easternOffset(when)}`);
  if (!Number.isFinite(at.getTime())) return "That date did not look right";
  if (at.getTime() < Date.now()) return "Pick a time in the future";

  const cohort = await data.getCohort();
  const start = new Date(cohort.startDate + "T00:00:00.000Z").getTime();
  const weekNo = Math.max(1, Math.floor((at.getTime() - start) / (7 * 24 * 3600 * 1000)) + 1);
  await data.createMeeting(pairingId, at.toISOString(), weekNo);
  return null;
}

export async function bookMeeting(formData: FormData) {
  const user = await currentUser();
  const pairingId = String(formData.get("pairingId"));
  const pairing = await data.getPairing(pairingId);
  if (!pairing || (pairing.founderId !== user.id && pairing.mentorId !== user.id)) return;
  const home = homeForRole(user.role);

  const error = await scheduleMeeting(pairingId, String(formData.get("scheduledAt") ?? ""));
  if (error) redirect(`${home}?error=${encodeURIComponent(error)}`);
  revalidatePath("/", "layout");
  redirect(`${home}?booked=1`);
}

export async function submitFlag(formData: FormData) {
  const user = await currentUser();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) redirect("/flag?error=Tell us what is going on");
  const rawCat = String(formData.get("category") ?? "other");
  const category = (["pattern_risk", "match_not_working", "conduct", "other"].includes(rawCat)
    ? rawCat : "other") as "pattern_risk" | "match_not_working" | "conduct" | "other";

  // You may only attach a flag to a pairing you are part of.
  let pairingId = String(formData.get("pairingId") ?? "") || null;
  if (pairingId) {
    const p = await data.getPairing(pairingId);
    if (!p || (p.founderId !== user.id && p.mentorId !== user.id)) pairingId = null;
  }
  await data.raiseFlag(user.id, pairingId, category, body);
  revalidatePath("/admin");
  redirect("/flag?sent=1");
}

export async function saveAvailability(formData: FormData) {
  const user = await currentUser();
  if (user.role !== "mentor") return;
  const availability = String(formData.get("availability") ?? "").trim();
  // Number("two") is NaN and Number("") is 0, so neither a typo nor an empty
  // box may reach the database. Both keep the capacity they already had, since
  // 0 means "take no new founders" and nobody should land there by accident.
  const typed = String(formData.get("capacity") ?? "").trim();
  const parsed = Number(typed);
  const capacity = typed && Number.isFinite(parsed)
    ? Math.min(10, Math.max(0, Math.round(parsed)))
    : (user.capacity ?? 1);
  await data.setAvailability(user.id, availability, capacity);
  revalidatePath("/", "layout");
  redirect("/mentor");
}

// US Eastern is UTC-4 from the second Sunday in March to the first Sunday in
// November, and UTC-5 otherwise. The program runs on Eastern time.
function easternOffset(local: string): string {
  const d = new Date(`${local}:00Z`);
  const year = d.getUTCFullYear();
  const secondSundayMarch = nthSunday(year, 2, 2);
  const firstSundayNovember = nthSunday(year, 10, 1);
  const t = d.getTime();
  return t >= secondSundayMarch && t < firstSundayNovember ? "-04:00" : "-05:00";
}

function nthSunday(year: number, monthIndex: number, n: number): number {
  const first = new Date(Date.UTC(year, monthIndex, 1));
  const offset = (7 - first.getUTCDay()) % 7;
  return Date.UTC(year, monthIndex, 1 + offset + (n - 1) * 7, 7); // 2am local
}

// ---- intake forms ----

// Pulls one answer per question out of FormData, shaped by question type.
function readAnswers(questions: FormQuestion[], formData: FormData) {
  const answers: Record<string, unknown> = {};
  const missing: string[] = [];
  for (const q of questions) {
    if (q.type === "statement") continue;
    let value: unknown;
    if (q.type === "multi_select") {
      value = formData.getAll(q.key).map(String).filter(Boolean);
      if (q.required && (value as string[]).length === 0) missing.push(q.label);
    } else if (q.type === "ranked_select") {
      const picks: string[] = [];
      for (let i = 0; i < (q.maxSelect ?? 3); i++) {
        const v = String(formData.get(`${q.key}__${i}`) ?? "").trim();
        if (v && !picks.includes(v)) picks.push(v);
      }
      value = picks;
      if (q.required && picks.length === 0) missing.push(q.label);
    } else if (q.type === "consent") {
      value = formData.get(q.key) === "yes";
      if (q.required && value !== true) missing.push(q.label);
    } else {
      value = String(formData.get(q.key) ?? "").trim();
      if (q.required && !value) missing.push(q.label);
    }
    answers[q.key] = value;
  }
  return { answers, missing };
}

// Both intake forms hand their answers back on failure so the page can put
// them straight back into the inputs. Success still redirects.
function stillNeeded(missing: string[]) {
  const shown = missing.slice(0, 3).join(", ");
  return missing.length > 3
    ? `Still needed: ${shown}, and ${missing.length - 3} more`
    : `Still needed: ${shown}`;
}

export async function submitMentorApplication(
  state: FormState, formData: FormData
): Promise<FormState> {
  const next = state.attempt + 1;
  // Spam trap. Silently accept so a bot cannot tell it failed.
  if (String(formData.get("website") ?? "")) redirect("/apply/thanks");

  const form = await getForm("mentor-application");
  if (!form) return { attempt: next, error: "This form is not available right now" };
  const { answers, missing } = readAnswers(form.questions, formData);
  if (missing.length) {
    return { attempt: next, error: stillNeeded(missing), values: answers };
  }
  const a = answers as Record<string, string>;
  const name = [a.first_name, a.last_name].filter(Boolean).join(" ").trim() || "Applicant";
  const email = (a.email ?? "").toLowerCase();
  const appId = await submitApplication("mentor-application", answers, name, email, a.phone ?? "");

  // Best effort: a failed email must not lose the application.
  await emailApplicationReceived(email, a.first_name || name);
  const adminTo = process.env.ADMIN_EMAIL;
  if (adminTo) await emailAdminNewApplication(adminTo, name, appId);
  redirect("/apply/thanks");
}

export async function submitMentorProfile(
  state: FormState, formData: FormData
): Promise<FormState> {
  const next = state.attempt + 1;
  const user = await currentUser();
  if (user.role !== "mentor") redirect("/");
  const form = await getForm("mentor-profile");
  if (!form) return { attempt: next, error: "This form is not available right now" };
  const { answers, missing } = readAnswers(form.questions, formData);
  if (missing.length) {
    return { attempt: next, error: stillNeeded(missing), values: answers };
  }
  await saveMentorProfile(user.id, answers);
  revalidatePath("/", "layout");
  redirect("/mentor");
}

// The founder intake form, which every founder fills in before they can use
// the app. It is the whole founder side of matching, so nothing here is
// optional except the two questions marked optional on the form itself.
export async function submitFounderIntake(
  state: FormState, formData: FormData
): Promise<FormState> {
  const next = state.attempt + 1;
  const user = await currentUser();
  if (user.role !== "founder") redirect(homeForRole(user.role));
  const form = await getForm("founder-intake");
  if (!form) return { attempt: next, error: "This form is not available right now" };
  const { answers, missing } = readAnswers(form.questions, formData);
  if (missing.length) {
    return { attempt: next, error: stillNeeded(missing), values: answers };
  }
  await saveFounderIntake(user.id, answers);
  revalidatePath("/", "layout");
  redirect("/founder?intake=1");
}

// The brief a founder writes to their mentor before the first meeting. It
// only makes sense once they know who they are writing to.
export async function submitFounderBrief(
  state: FormState, formData: FormData
): Promise<FormState> {
  const next = state.attempt + 1;
  const user = await currentUser();
  if (user.role !== "founder") redirect(homeForRole(user.role));
  const pairs = await data.pairingsForUser(user.id);
  if (!pairs.length) redirect("/founder");
  const form = await getForm("founder-brief");
  if (!form) return { attempt: next, error: "This form is not available right now" };
  const { answers, missing } = readAnswers(form.questions, formData);
  if (missing.length) {
    return { attempt: next, error: stillNeeded(missing), values: answers };
  }
  await saveFounderBrief(user.id, answers);
  revalidatePath("/", "layout");
  redirect("/founder?briefed=1");
}

// The weekly update. Filing twice in the same week edits that week rather
// than adding a second row, so the trend stays one point per week.
export async function submitWeeklyUpdate(
  state: FormState, formData: FormData
): Promise<FormState> {
  const next = state.attempt + 1;
  const user = await currentUser();
  if (user.role !== "founder") redirect(homeForRole(user.role));
  const form = await getForm("founder-weekly");
  if (!form) return { attempt: next, error: "This form is not available right now" };
  const { answers, missing } = readAnswers(form.questions, formData);
  if (missing.length) {
    return { attempt: next, error: stillNeeded(missing), values: answers };
  }

  const [cohort, week, now] = await Promise.all([
    data.getCohort(), data.weekNumber(), data.currentTime(),
  ]);
  await saveWeekly({
    founderId: user.id,
    cohortId: cohort.id === "none" ? null : cohort.id,
    weekStart: weekStartOf(now),
    weekNumber: week,
    answers,
  });

  // A founder who re-ranks what they need help with has just changed the
  // input matching runs on. Writing it back is the point of asking.
  const reranked = answers.needs_changed;
  if (Array.isArray(reranked) && reranked.length) {
    await setFounderNeeds(user.id, reranked.map(String));
  }

  revalidatePath("/", "layout");
  redirect("/weekly?filed=1");
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
    | "founder" | "mentor" | "admin";
  const expertise = String(formData.get("expertise") ?? "")
    .split(",").map((s) => s.trim()).filter(Boolean);

  // Email is unique in the database, so a duplicate would otherwise fail
  // silently and still report success.
  const clash = (await data.listUsers()).find((u) => u.email.toLowerCase() === email);
  if (clash) {
    redirect(`/admin/people?error=${encodeURIComponent(`${clash.name} already uses ${email}`)}`);
  }

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
  const role = String(formData.get("role")) as "founder" | "mentor" | "admin";
  const before = await data.getUser(id);
  if (!before || before.role === role) return;
  // Changing your own role locks you out with no way back.
  if (id === admin.id) {
    redirect("/admin/people?error=Ask another admin to change your own role");
  }
  // Never let the last admin be demoted out of the system.
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
  // The pair decides how often they meet, so a new pairing starts with no
  // declared cadence rather than one the program picked for them.
  const rationale = String(formData.get("rationale") ?? "").trim();
  await data.createPairing(cohortId, founderId, mentorId, "as_needed", rationale);
  await data.writeAudit({
    actorId: admin.id, action: "pairing.created", subjectType: "pairing", subjectId: null,
    metadata: { founderId, mentorId },
  });
  revalidatePath("/", "layout");
  redirect("/admin/pairings");
}

export async function changePairing(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status") ?? "") as
    "" | "proposed" | "active" | "paused" | "completed" | "dissolved";
  // Cadence is no longer set by anyone: health reads the rhythm the pair keeps.
  await data.updatePairing(id, { status: status || undefined });
  await data.writeAudit({
    actorId: admin.id, action: "pairing.updated", subjectType: "pairing", subjectId: id,
    metadata: { status: status || undefined },
  });
  revalidatePath("/", "layout");
}

export async function importPeople(formData: FormData) {
  const admin = await requireAdmin();
  const cohortId = String(formData.get("cohortId") ?? "");
  const joinCohort = formData.get("joinCohort") === "on";
  const joinPool = formData.get("joinPool") === "on";

  let rows: ImportRow[];
  try {
    rows = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    redirect("/admin/import?error=Could not read that list, try previewing again");
  }

  const existing = new Set((await data.listUsers()).map((u) => u.email.toLowerCase()));
  const createdFounders: string[] = [];
  const createdMentors: string[] = [];
  let skipped = 0;
  let createdCount = 0;

  for (const r of rows) {
    const email = (r.email ?? "").trim().toLowerCase();
    if (!email || !r.name || existing.has(email)) { skipped++; continue; }
    const id = await data.createUser({
      email, name: r.name, role: r.role,
      company: r.company, stage: r.stage, bio: r.bio, expertise: r.expertise,
    });
    existing.add(email);
    createdCount++;
    if (r.role === "founder") createdFounders.push(id);
    if (r.role === "mentor") createdMentors.push(id);
  }

  if (cohortId && joinCohort && createdFounders.length) {
    await data.addCohortMembers(cohortId, createdFounders);
  }
  if (cohortId && joinPool && createdMentors.length) {
    await data.addToMentorPool(cohortId, createdMentors);
  }

  const created = createdCount;
  await data.writeAudit({
    actorId: admin.id, action: "people.imported", subjectType: "cohort",
    subjectId: cohortId || null,
    metadata: { created, skipped, founders: createdFounders.length, mentors: createdMentors.length },
  });

  revalidatePath("/", "layout");
  redirect(`/admin/people?added=${encodeURIComponent(`${created} people imported, ${skipped} skipped`)}`);
}

// ---- form editor ----

// One option per line: "label" or "label | description".
// `existing` preserves the stored value for any label already in use, so
// editing a question never rewrites the vocabulary that answers and matching
// are keyed on.
function parseOptions(raw: string, existing: QuestionOption[] = []) {
  const byLabel = new Map(existing.map((o) => [o.label.toLowerCase(), o.value]));
  const used = new Set<string>();
  return raw.split("\n").map((l) => l.trim()).filter(Boolean).map((line, i) => {
    const [label, description] = line.split("|").map((s) => s.trim());
    if (!label) return null;
    let value = byLabel.get(label.toLowerCase())
      ?? label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40);
    if (!value) value = `option_${i + 1}`;
    while (used.has(value)) value = `${value}_2`;
    used.add(value);
    return { value, label, ...(description ? { description } : {}) };
  }).filter(Boolean) as QuestionOption[];
}

// Rejects blank and non-numeric input rather than letting NaN through, which
// silently rendered zero choices and made the question impossible to answer.
function parseMax(raw: string): number | undefined {
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.min(10, Math.round(n));
}

export async function createQuestion(formData: FormData) {
  const admin = await requireAdmin();
  const slug = String(formData.get("slug"));
  const label = String(formData.get("label") ?? "").trim();
  if (!label) redirect(`/admin/forms/${slug}?error=Give the question a label`);
  const type = String(formData.get("type") ?? "short_text") as QuestionType;
  // Archived questions still own their key, so they must count as taken.
  const form = await getFormForEditing(slug);
  const taken = (form?.questions ?? []).map((q) => q.key);
  const key = slugifyKey(String(formData.get("key") ?? "") || label, taken);

  await addQuestion(slug, {
    key,
    section: String(formData.get("section") ?? "").trim() || "General",
    type,
    label,
    help: String(formData.get("help") ?? "").trim() || undefined,
    body: String(formData.get("body") ?? "").trim() || undefined,
    options: parseOptions(String(formData.get("options") ?? "")),
    required: formData.get("required") === "on",
    maxSelect: parseMax(String(formData.get("maxSelect") ?? "")),
  });
  await data.writeAudit({
    actorId: admin.id, action: "form.question_added", subjectType: "form", subjectId: slug,
    metadata: { key, type, label },
  });
  revalidatePath(`/admin/forms/${slug}`);
  redirect(`/admin/forms/${slug}?added=${encodeURIComponent(label)}`);
}

export async function editQuestion(formData: FormData) {
  const admin = await requireAdmin();
  const slug = String(formData.get("slug"));
  const id = String(formData.get("id"));
  const patch: Partial<FormQuestion> = {
    label: String(formData.get("label") ?? ""),
    section: String(formData.get("section") ?? "General"),
    help: String(formData.get("help") ?? ""),
    body: String(formData.get("body") ?? ""),
    required: formData.get("required") === "on",
  };
  const form = await getFormForEditing(slug);
  const current = form?.questions.find((q) => q.id === id);
  const optionsRaw = String(formData.get("options") ?? "");
  if (optionsRaw.trim()) patch.options = parseOptions(optionsRaw, current?.options ?? []);
  patch.maxSelect = parseMax(String(formData.get("maxSelect") ?? ""));

  await updateQuestion(id, patch);
  await data.writeAudit({
    actorId: admin.id, action: "form.question_edited", subjectType: "form", subjectId: slug,
    metadata: { id, label: patch.label },
  });
  revalidatePath(`/admin/forms/${slug}`);
}

export async function reorderQuestion(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug"));
  // Only one step at a time, and never NaN, which used to throw a 500.
  const dir = Number(formData.get("dir")) < 0 ? -1 : 1;
  await moveQuestion(slug, String(formData.get("id")), dir);
  revalidatePath(`/admin/forms/${slug}`);
}

export async function removeQuestion(formData: FormData) {
  const admin = await requireAdmin();
  const slug = String(formData.get("slug"));
  const id = String(formData.get("id"));
  const permanent = formData.get("permanent") === "yes";
  // Asking for a permanent delete on an answered question archives it
  // instead, so the log records what actually happened.
  const outcome = await deleteQuestion(slug, id, permanent);
  await data.writeAudit({
    actorId: admin.id, action: outcome === "deleted" ? "form.question_deleted" : "form.question_archived",
    subjectType: "form", subjectId: slug, metadata: { id },
  });
  revalidatePath(`/admin/forms/${slug}`);
}

export async function restoreQuestion(formData: FormData) {
  await requireAdmin();
  const slug = String(formData.get("slug"));
  await updateQuestion(String(formData.get("id")), { archived: false });
  revalidatePath(`/admin/forms/${slug}`);
}

export async function editFormCopy(formData: FormData) {
  const admin = await requireAdmin();
  const slug = String(formData.get("slug"));
  await updateFormCopy(slug, {
    introTitle: String(formData.get("introTitle") ?? ""),
    introBody: String(formData.get("introBody") ?? ""),
    introNote: String(formData.get("introNote") ?? ""),
    closingTitle: String(formData.get("closingTitle") ?? ""),
    closingBody: String(formData.get("closingBody") ?? ""),
  });
  await data.writeAudit({
    actorId: admin.id, action: "form.copy_edited", subjectType: "form", subjectId: slug, metadata: {},
  });
  revalidatePath(`/admin/forms/${slug}`);
}

// ---- applicants ----

export async function reviewApplicant(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const status = String(formData.get("status")) as "new" | "reviewing" | "accepted" | "declined";
  const note = String(formData.get("note") ?? "");

  const app = await getApplication(id);
  const firstName = String((app?.answers as Record<string, string>)?.first_name ?? app?.name ?? "there");

  if (status === "accepted") {
    const userId = await acceptApplicant(id, admin.id);
    if (app?.email) await emailAccepted(app.email, firstName, userId);
    await data.writeAudit({
      actorId: admin.id, action: "applicant.accepted", subjectType: "application", subjectId: id,
      metadata: { userId, emailed: app?.email ?? null },
    });
  } else {
    await setApplicationStatus(id, status, admin.id, note);
    if (status === "declined" && app?.email) await emailDeclined(app.email, firstName);
    await data.writeAudit({
      actorId: admin.id, action: `applicant.${status}`, subjectType: "application", subjectId: id,
      metadata: {},
    });
  }
  revalidatePath("/admin/applicants");
  redirect("/admin/applicants");
}

export async function markActionItem(formData: FormData) {
  const user = await currentUser();
  const id = String(formData.get("id"));
  // Derive the pairing from the item itself. Trusting a pairingId from the
  // form let anyone toggle any item by omitting the field.
  if (user.role !== "admin") {
    const mine = await data.pairingsForUser(user.id);
    const lists = await Promise.all(mine.map((p) => data.actionItemsForPairing(p.id)));
    if (!lists.flat().some((a) => a.id === id)) return;
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
  revalidatePath("/admin/matches");
}

// Run the matcher for one founder: the hard filter, the weighted score, and
// a ranked shortlist of five written to match_suggestions. This only
// suggests — confirming a match is a separate, human act.
export async function suggestMatches(formData: FormData) {
  const admin = await requireAdmin();
  const founderId = String(formData.get("founderId"));
  const founder = await data.getUser(founderId);
  if (!founder || founder.role !== "founder") redirect("/admin/matches");

  const cohort = await data.getCohort();
  const [users, poolIds, loads] = await Promise.all([
    data.listUsers(), data.mentorPool(cohort.id), data.mentorLoads(),
  ]);
  // The pool is the mentors who volunteered for 1:1 duty this cohort. Before
  // the week 2 filter has been done the pool is empty, and the matcher falls
  // back to every active mentor rather than refusing to run.
  const poolSet = new Set(poolIds);
  const candidates = users.filter(
    (u) => u.role === "mentor" && u.status !== "inactive" && (poolSet.size === 0 || poolSet.has(u.id))
  );

  const result = buildShortlist(founder, candidates, loads);
  await data.replaceSuggestions(cohort.id, founderId, result.shortlist.map((e) => ({
    mentorId: e.mentor.id, score: e.score.total ?? 0, breakdown: e.breakdown,
    rationale: e.rationale, rank: e.rank,
  })));

  await data.writeAudit({
    actorId: admin.id, action: "match.suggested", subjectType: "user", subjectId: founderId,
    metadata: {
      founder: founder.name, considered: result.considered,
      excluded: result.excluded.length, shortlisted: result.shortlist.length,
    },
  });
  revalidatePath("/admin/matches");
  redirect(`/admin/matches?suggest=${founderId}`);
}

// Write (or rewrite) the consolidated report's narrative for one week. The
// numbers on the page never come from here — they are computed at render
// time — so regenerating can only ever change the prose.
export async function generateReportNarrative(formData: FormData) {
  const admin = await requireAdmin();
  const weekStart = String(formData.get("weekStart"));
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) redirect("/admin/report");

  const cohort = await data.getCohort();
  const facts = await assembleReport(cohort, weekStart, await data.currentTime());

  let model = "composed";
  let narrative = composeFallback(facts);
  if (geminiConfigured()) {
    const result = await writeNarrative(narrativeInput(facts));
    if (!result.ok) {
      redirect(`/admin/report?week=${weekStart}&error=${encodeURIComponent(result.reason)}`);
    }
    model = GEMINI_MODEL;
    narrative = result.narrative;
  }

  await saveNarrative(cohort.id, weekStart, narrative, model, admin.id);
  await data.writeAudit({
    actorId: admin.id, action: "report.generated", subjectType: "cohort", subjectId: cohort.id,
    metadata: { weekStart, model, filed: facts.filed.length, founders: facts.founders.length },
  });
  revalidatePath("/admin/report");
  redirect(`/admin/report?week=${weekStart}`);
}

export async function selectMatch(formData: FormData) {
  const user = await currentUser();
  if (user.role !== "admin") return;
  const id = String(formData.get("suggestionId"));
  const created = await data.confirmMatch(id);

  // Introduce exactly the two people in the pairing that was just created.
  let emailed = false;
  if (created) {
    const [founder, mentor] = await Promise.all([
      data.getUser(created.founderId), data.getUser(created.mentorId),
    ]);
    if (founder?.email && mentor?.email) {
      const deadline = new Date(Date.now() + 5 * 86400000).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      });
      await emailMatchIntro({
        to: founder.email, userId: founder.id, recipientFirst: founder.name.split(" ")[0],
        otherName: mentor.name, otherRole: "mentor", rationale: created.matchRationale,
        contact: mentor.email, firstContactOwner: "You", deadline,
      });
      await emailMatchIntro({
        to: mentor.email, userId: mentor.id, recipientFirst: mentor.name.split(" ")[0],
        otherName: founder.name, otherRole: "founder", rationale: created.matchRationale,
        contact: founder.email, firstContactOwner: founder.name.split(" ")[0], deadline,
      });
      emailed = true;
    }
  }

  await data.writeAudit({
    actorId: user.id, action: "match.confirmed", subjectType: "pairing",
    subjectId: created?.id ?? null,
    metadata: { suggestionId: id, founderId: created?.founderId, mentorId: created?.mentorId, emailed },
  });
  revalidatePath("/", "layout");
}
