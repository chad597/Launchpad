// Form definitions, submissions, and the applicant pipeline.
// Demo mode keeps everything in memory, seeded from the same constants the
// migration seeds the database with, so the public form renders identically.
import { supabaseServer, isDemo } from "./supabase/server";
import {
  DEFAULT_MENTOR_FORM, DEFAULT_PROFILE_FORM,
  type FormDefinition, type FormQuestion, type QuestionOption, type QuestionType,
} from "./mentor-form";
import {
  DEFAULT_FOUNDER_BRIEF_FORM, DEFAULT_FOUNDER_INTAKE_FORM, founderStageLine,
} from "./founder-form";
import { DEFAULT_FOUNDER_WEEKLY_FORM } from "./weekly-form";
import { weeklyAnsweredKeys } from "./weekly";
import { DEMO_FOUNDER_PROFILES } from "./fixtures";
import { setNeeds as demoSetNeeds } from "./store";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface Application {
  id: string;
  name: string;
  email: string;
  phone: string;
  answers: Record<string, unknown>;
  status: "new" | "reviewing" | "accepted" | "declined";
  reviewNote?: string;
  submittedAt: string;
  invitedUserId?: string | null;
}

// What a founder told us, in the two places they told us: the intake form
// they fill in at first sign-in, and the brief they write once they know who
// their mentor is.
export interface FounderProfile {
  intake: Record<string, unknown> | null;
  intakeAt: string | null;
  brief: Record<string, unknown> | null;
  briefAt: string | null;
}

export const EMPTY_FOUNDER_PROFILE: FounderProfile = {
  intake: null, intakeAt: null, brief: null, briefAt: null,
};

interface FormStore {
  forms: FormDefinition[];
  applications: Application[];
  founderProfiles: Record<string, FounderProfile>;
}

const g = globalThis as unknown as { __formStore?: FormStore };
function mem(): FormStore {
  if (!g.__formStore) {
    g.__formStore = {
      forms: [
        structuredClone(DEFAULT_MENTOR_FORM), structuredClone(DEFAULT_PROFILE_FORM),
        structuredClone(DEFAULT_FOUNDER_INTAKE_FORM), structuredClone(DEFAULT_FOUNDER_BRIEF_FORM),
        structuredClone(DEFAULT_FOUNDER_WEEKLY_FORM),
      ],
      applications: [],
      founderProfiles: structuredClone(DEMO_FOUNDER_PROFILES),
    };
  }
  return g.__formStore;
}

function mapQuestion(r: any): FormQuestion {
  return {
    id: r.id, key: r.key, section: r.section, position: r.position,
    type: r.type as QuestionType, label: r.label,
    help: r.help ?? undefined, body: r.body ?? undefined,
    options: (r.options ?? []) as QuestionOption[],
    required: r.required, maxSelect: r.max_select ?? undefined,
    archived: r.archived,
  };
}

export async function getForm(slug: string): Promise<FormDefinition | null> {
  if (isDemo()) {
    const f = mem().forms.find((x) => x.slug === slug);
    return f ? { ...f, questions: f.questions.filter((q) => !q.archived) } : null;
  }
  const sb = await supabaseServer();
  const { data: def } = await sb.from("form_definitions").select("*").eq("slug", slug).maybeSingle();
  if (!def) return null;
  const { data: qs } = await sb
    .from("form_questions").select("*").eq("form_id", def.id).eq("archived", false)
    .order("position", { ascending: true });
  return {
    slug: def.slug, name: def.name,
    introTitle: def.intro_title ?? "", introBody: def.intro_body ?? "",
    introNote: def.intro_note ?? undefined,
    closingTitle: def.closing_title ?? "", closingBody: def.closing_body ?? "",
    questions: (qs ?? []).map(mapQuestion),
  };
}

// Admin editor needs archived questions too, so they can be restored.
export async function getFormForEditing(slug: string): Promise<FormDefinition | null> {
  if (isDemo()) {
    const f = mem().forms.find((x) => x.slug === slug);
    return f ? structuredClone(f) : null;
  }
  const sb = await supabaseServer();
  const { data: def } = await sb.from("form_definitions").select("*").eq("slug", slug).maybeSingle();
  if (!def) return null;
  const { data: qs } = await sb
    .from("form_questions").select("*").eq("form_id", def.id).order("position", { ascending: true });
  return {
    slug: def.slug, name: def.name,
    introTitle: def.intro_title ?? "", introBody: def.intro_body ?? "",
    introNote: def.intro_note ?? undefined,
    closingTitle: def.closing_title ?? "", closingBody: def.closing_body ?? "",
    questions: (qs ?? []).map(mapQuestion),
  };
}

export async function listForms(): Promise<{ slug: string; name: string; count: number }[]> {
  if (isDemo()) {
    return mem().forms.map((f) => ({
      slug: f.slug, name: f.name, count: f.questions.filter((q) => !q.archived).length,
    }));
  }
  const sb = await supabaseServer();
  const { data } = await sb.from("form_definitions").select("slug, name, form_questions(count)");
  return (data ?? []).map((r: any) => ({
    slug: r.slug, name: r.name, count: r.form_questions?.[0]?.count ?? 0,
  }));
}

async function formIdFor(slug: string): Promise<string | null> {
  const sb = await supabaseServer();
  const { data } = await sb.from("form_definitions").select("id").eq("slug", slug).maybeSingle();
  return data?.id ?? null;
}

// ---- editing ----

export async function addQuestion(slug: string, q: Omit<FormQuestion, "id" | "position">) {
  if (isDemo()) {
    const f = mem().forms.find((x) => x.slug === slug);
    if (!f) return;
    const pos = Math.max(0, ...f.questions.map((x) => x.position)) + 10;
    f.questions.push({ ...q, id: `q-${q.key}-${Date.now()}`, position: pos });
    return;
  }
  const sb = await supabaseServer();
  const formId = await formIdFor(slug);
  if (!formId) return;
  const { data: last } = await sb
    .from("form_questions").select("position").eq("form_id", formId)
    .order("position", { ascending: false }).limit(1).maybeSingle();
  await sb.from("form_questions").insert({
    form_id: formId, key: q.key, section: q.section, type: q.type, label: q.label,
    help: q.help ?? null, body: q.body ?? null, options: q.options ?? [],
    required: q.required, max_select: q.maxSelect ?? null,
    position: (last?.position ?? 0) + 10,
  });
}

export async function updateQuestion(id: string, patch: Partial<FormQuestion>) {
  if (isDemo()) {
    for (const f of mem().forms) {
      const q = f.questions.find((x) => x.id === id);
      if (q) Object.assign(q, patch);
    }
    return;
  }
  const sb = await supabaseServer();
  const row: Record<string, unknown> = {};
  if (patch.label !== undefined) row.label = patch.label;
  if (patch.help !== undefined) row.help = patch.help || null;
  if (patch.body !== undefined) row.body = patch.body || null;
  if (patch.section !== undefined) row.section = patch.section;
  if (patch.required !== undefined) row.required = patch.required;
  if (patch.maxSelect !== undefined) row.max_select = patch.maxSelect ?? null;
  if (patch.options !== undefined) row.options = patch.options;
  if (patch.type !== undefined) row.type = patch.type;
  if (patch.archived !== undefined) row.archived = patch.archived;
  if (Object.keys(row).length) await sb.from("form_questions").update(row).eq("id", id);
}

export async function moveQuestion(slug: string, id: string, direction: -1 | 1) {
  const form = await getFormForEditing(slug);
  if (!form) return;
  const live = form.questions.filter((q) => !q.archived);
  const i = live.findIndex((q) => q.id === id);
  const j = i + direction;
  if (i < 0 || j < 0 || j >= live.length) return;
  const a = live[i], b = live[j];
  if (isDemo()) {
    const f = mem().forms.find((x) => x.slug === slug)!;
    const qa = f.questions.find((x) => x.id === a.id)!;
    const qb = f.questions.find((x) => x.id === b.id)!;
    const t = qa.position; qa.position = qb.position; qb.position = t;
    f.questions.sort((x, y) => x.position - y.position);
    return;
  }
  const sb = await supabaseServer();
  await sb.from("form_questions").update({ position: b.position }).eq("id", a.id);
  await sb.from("form_questions").update({ position: a.position }).eq("id", b.id);
}

// Every question key anyone has ever answered on this form. Answers render
// from the live form definition, so deleting a question hides its answers
// even though the jsonb survives; this is what keeps "Delete for good"
// honest.
export async function answeredKeys(slug: string): Promise<Set<string>> {
  const keys = new Set<string>();
  const collect = (answers: unknown) => {
    if (!answers || typeof answers !== "object") return;
    for (const [k, v] of Object.entries(answers as Record<string, unknown>)) {
      if (v != null && v !== "" && !(Array.isArray(v) && v.length === 0)) keys.add(k);
    }
  };

  if (slug === "founder-weekly") return weeklyAnsweredKeys();

  if (isDemo()) {
    if (slug === "mentor-application") {
      for (const a of mem().applications) collect(a.answers);
    } else if (slug === "founder-intake") {
      for (const p of Object.values(mem().founderProfiles)) collect(p.intake);
    } else if (slug === "founder-brief") {
      for (const p of Object.values(mem().founderProfiles)) collect(p.brief);
    }
    // The demo never stores mentor profile answers, so that form stays freely
    // deletable there.
    return keys;
  }

  const sb = await supabaseServer();
  if (slug === "mentor-application") {
    const { data } = await sb.from("mentor_applications").select("answers");
    for (const r of data ?? []) collect(r.answers);
  } else if (slug === "mentor-profile" || slug === "founder-intake") {
    const role = slug === "mentor-profile" ? "mentor" : "founder";
    const { data } = await sb.from("users").select("profile_answers").eq("role", role);
    for (const r of data ?? []) collect(r.profile_answers);
  } else if (slug === "founder-brief") {
    const { data } = await sb.from("users").select("brief_answers").eq("role", "founder");
    for (const r of data ?? []) collect(r.brief_answers);
  }
  return keys;
}

// Archive by default: submitted answers stay readable. Only a question that
// nothing has answered can be removed outright; a permanent delete of an
// answered question falls back to archiving, and the return value says which
// one actually happened.
export async function deleteQuestion(
  slug: string, id: string, permanent: boolean
): Promise<"deleted" | "archived"> {
  let outcome: "deleted" | "archived" = permanent ? "deleted" : "archived";
  if (permanent) {
    const form = await getFormForEditing(slug);
    const key = form?.questions.find((q) => q.id === id)?.key;
    if (key && (await answeredKeys(slug)).has(key)) outcome = "archived";
  }

  if (isDemo()) {
    for (const f of mem().forms) {
      const i = f.questions.findIndex((x) => x.id === id);
      if (i >= 0) {
        if (outcome === "deleted") f.questions.splice(i, 1);
        else f.questions[i].archived = true;
      }
    }
    return outcome;
  }
  const sb = await supabaseServer();
  if (outcome === "deleted") await sb.from("form_questions").delete().eq("id", id);
  else await sb.from("form_questions").update({ archived: true }).eq("id", id);
  return outcome;
}

export async function updateFormCopy(slug: string, patch: Partial<FormDefinition>) {
  if (isDemo()) {
    const f = mem().forms.find((x) => x.slug === slug);
    if (f) Object.assign(f, patch);
    return;
  }
  const sb = await supabaseServer();
  await sb.from("form_definitions").update({
    intro_title: patch.introTitle, intro_body: patch.introBody, intro_note: patch.introNote || null,
    closing_title: patch.closingTitle, closing_body: patch.closingBody,
    updated_at: new Date().toISOString(),
  }).eq("slug", slug);
}

// ---- submissions ----

// Returns the new application id. The caller is anonymous and cannot read the
// applications table back, so the insert has to hand the id over directly.
export async function submitApplication(
  slug: string, answers: Record<string, unknown>, name: string, email: string, phone: string
): Promise<string> {
  if (isDemo()) {
    const id = `app-${Date.now()}`;
    mem().applications.unshift({
      id, name, email, phone, answers, status: "new", submittedAt: new Date().toISOString(),
    });
    return id;
  }
  const sb = await supabaseServer();
  const formId = await formIdFor(slug);
  // No .select() on this insert: the applicant has no session, and asking
  // for the row back runs it through the staff-only read policy, which
  // aborts the whole insert. This exact combination silently broke the
  // public form once; the id is not worth that.
  const { error } = await sb.from("mentor_applications").insert({
    form_id: formId, name, email, phone, answers, status: "new",
  });
  if (error) throw new Error(`Application could not be saved: ${error.message}`);
  return "";
}

export async function listApplications(status?: string): Promise<Application[]> {
  if (isDemo()) {
    const all = mem().applications;
    return status ? all.filter((a) => a.status === status) : all;
  }
  const sb = await supabaseServer();
  let query = sb.from("mentor_applications").select("*").order("submitted_at", { ascending: false });
  if (status) query = query.eq("status", status);
  const { data } = await query;
  return (data ?? []).map((r: any) => ({
    id: r.id, name: r.name ?? "", email: r.email ?? "", phone: r.phone ?? "",
    answers: r.answers ?? {}, status: r.status, reviewNote: r.review_note ?? undefined,
    submittedAt: r.submitted_at, invitedUserId: r.invited_user_id,
  }));
}

export async function getApplication(id: string): Promise<Application | null> {
  if (isDemo()) return mem().applications.find((a) => a.id === id) ?? null;
  const sb = await supabaseServer();
  const { data: r } = await sb.from("mentor_applications").select("*").eq("id", id).maybeSingle();
  if (!r) return null;
  return {
    id: r.id, name: r.name ?? "", email: r.email ?? "", phone: r.phone ?? "",
    answers: r.answers ?? {}, status: r.status, reviewNote: r.review_note ?? undefined,
    submittedAt: r.submitted_at, invitedUserId: r.invited_user_id,
  };
}

export async function setApplicationStatus(
  id: string, status: Application["status"], reviewerId: string, note?: string
) {
  if (isDemo()) {
    const a = mem().applications.find((x) => x.id === id);
    if (a) { a.status = status; if (note !== undefined) a.reviewNote = note; }
    return;
  }
  const sb = await supabaseServer();
  await sb.from("mentor_applications").update({
    status, review_note: note ?? null, reviewed_by: reviewerId, reviewed_at: new Date().toISOString(),
  }).eq("id", id);
}

// Accepting an applicant creates their mentor account and copies the answers
// that matching reads onto the user record. They complete the profile form at
// first sign-in.
export async function acceptApplicant(id: string, reviewerId: string): Promise<string | null> {
  const app = await getApplication(id);
  if (!app) return null;
  const a = app.answers as Record<string, any>;
  const name = [a.first_name, a.last_name].filter(Boolean).join(" ") || app.name;

  if (isDemo()) {
    await setApplicationStatus(id, "accepted", reviewerId);
    return "demo-user";
  }

  const sb = await supabaseServer();
  const { data: existing } = await sb
    .from("users").select("id").eq("email", app.email.toLowerCase()).maybeSingle();

  const fields = {
    name, email: app.email.toLowerCase(), role: "mentor" as const,
    phone: a.phone ?? null, company: a.company ?? null, title: a.title ?? null,
    linkedin: a.linkedin ?? null, time_zone: a.time_zone ?? null,
    years_experience: a.years_experience ?? null,
    background: a.background ?? null, industries: a.industries ?? null,
    skills: a.skills ?? [], story: a.story ?? null, tracks: a.tracks ?? null,
    referral_source: a.referral ?? null,
    invited_at: new Date().toISOString(),
  };

  let userId = existing?.id ?? null;
  if (userId) {
    await sb.from("users").update(fields).eq("id", userId);
  } else {
    const { data: created } = await sb.from("users").insert(fields).select("id").maybeSingle();
    userId = created?.id ?? null;
  }

  await sb.from("mentor_applications").update({
    status: "accepted", reviewed_by: reviewerId, reviewed_at: new Date().toISOString(),
    invited_user_id: userId,
  }).eq("id", id);

  return userId;
}

// Profile form (Form B) submitted by an accepted mentor at first sign-in.
export async function saveMentorProfile(userId: string, answers: Record<string, unknown>) {
  if (isDemo()) return;
  const sb = await supabaseServer();
  const a = answers as Record<string, any>;
  await sb.from("users").update({
    bio: a.bio ?? null,
    avoid_skills: a.avoid_skills ?? null,
    mentoring_format: a.mentoring_format ?? null,
    stage_preference: a.stage_preference ?? null,
    capacity: a.capacity ? Number(a.capacity) : 1,
    availability: a.availability ?? null,
    conflicts: a.conflicts ?? null,
    mentor_motivation: a.mentor_motivation ?? null,
    profile_answers: answers,
    profile_completed_at: new Date().toISOString(),
  }).eq("id", userId);
}

// ---- founder intake and brief ----

// Blank answers are stored as null rather than skipped, so clearing a field
// clears the column too. A key that is missing entirely means the admin
// archived that question, and the column it feeds is left alone.
function textCol(v: unknown): string | null | undefined {
  if (v === undefined) return undefined;
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function dropUndefined(row: Record<string, unknown>) {
  for (const k of Object.keys(row)) if (row[k] === undefined) delete row[k];
  return row;
}

// The founder intake form, filled in at first sign-in. The answers matching
// reads are copied onto the user record; the whole set is kept as jsonb so
// the mentor-facing view renders whatever questions the form asks today.
export async function saveFounderIntake(userId: string, answers: Record<string, unknown>) {
  const a = answers as Record<string, any>;
  const now = new Date().toISOString();

  if (isDemo()) {
    const store = mem().founderProfiles;
    const prior = store[userId] ?? EMPTY_FOUNDER_PROFILE;
    store[userId] = { ...prior, intake: answers, intakeAt: now };
    return;
  }

  const sb = await supabaseServer();
  const row = dropUndefined({
    phone: textCol(a.phone),
    company: textCol(a.company),
    website: textCol(a.website),
    linkedin: textCol(a.linkedin),
    time_zone: textCol(a.time_zone),
    availability: textCol(a.availability),
    bio: textCol(a.one_liner),
    founder_stage: textCol(a.stage),
    team_shape: textCol(a.team),
    time_commitment: textCol(a.commitment),
    challenge: textCol(a.biggest_challenge),
    goal: textCol(a.win),
    mentoring_format: textCol(a.mentoring_format),
    industry_pref: textCol(a.industry_pref),
    // Stored as a one-element array so it joins against a mentor's industries
    // the same way on both sides.
    industries: a.industry === undefined ? undefined : a.industry ? [a.industry] : [],
    needs: Array.isArray(a.needs) ? a.needs : undefined,
    strengths: Array.isArray(a.strengths) ? a.strengths : undefined,
    // The one-line summary mentor and admin lists already render.
    stage: a.stage === undefined && a.industry === undefined
      ? undefined
      : founderStageLine(a.stage, a.industry) || null,
    profile_answers: answers,
    profile_completed_at: now,
  });
  await sb.from("users").update(row).eq("id", userId);
}

// The brief, written to the mentor once a pairing exists. Nothing here feeds
// matching, so it stays as jsonb and is rendered from the form definition.
export async function saveFounderBrief(userId: string, answers: Record<string, unknown>) {
  const now = new Date().toISOString();
  if (isDemo()) {
    const store = mem().founderProfiles;
    const prior = store[userId] ?? EMPTY_FOUNDER_PROFILE;
    store[userId] = { ...prior, brief: answers, briefAt: now };
    return;
  }
  const sb = await supabaseServer();
  await sb.from("users")
    .update({ brief_answers: answers, brief_completed_at: now })
    .eq("id", userId);
}

// A founder re-ranks what they need help with on the weekly update. It has to
// land on the column matching reads and in the intake answers their mentor
// sees, or the two would disagree about what the founder asked for.
export async function setFounderNeeds(userId: string, needs: string[]) {
  if (isDemo()) {
    demoSetNeeds(userId, needs);
    const store = mem().founderProfiles;
    const prior = store[userId];
    if (prior?.intake) store[userId] = { ...prior, intake: { ...prior.intake, needs } };
    return;
  }
  const sb = await supabaseServer();
  const { data } = await sb.from("users").select("profile_answers").eq("id", userId).maybeSingle();
  const answers = { ...((data?.profile_answers as Record<string, unknown>) ?? {}), needs };
  await sb.from("users").update({ needs, profile_answers: answers }).eq("id", userId);
}

export async function getFounderProfile(userId: string): Promise<FounderProfile> {
  if (isDemo()) return mem().founderProfiles[userId] ?? EMPTY_FOUNDER_PROFILE;
  const sb = await supabaseServer();
  const { data } = await sb
    .from("users").select("profile_answers, profile_completed_at, brief_answers, brief_completed_at")
    .eq("id", userId).maybeSingle();
  if (!data) return EMPTY_FOUNDER_PROFILE;
  return {
    intake: data.profile_completed_at ? (data.profile_answers ?? {}) : null,
    intakeAt: data.profile_completed_at ?? null,
    brief: data.brief_completed_at ? (data.brief_answers ?? {}) : null,
    briefAt: data.brief_completed_at ?? null,
  };
}

export async function needsProfile(userId: string): Promise<boolean> {
  if (isDemo()) return false;
  const sb = await supabaseServer();
  const { data } = await sb.from("users").select("profile_completed_at").eq("id", userId).maybeSingle();
  return !!data && !data.profile_completed_at;
}
