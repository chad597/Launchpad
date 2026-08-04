// Form definitions, submissions, and the applicant pipeline.
// Demo mode keeps everything in memory, seeded from the same constants the
// migration seeds the database with, so the public form renders identically.
import { supabaseServer, isDemo } from "./supabase/server";
import {
  DEFAULT_MENTOR_FORM, DEFAULT_PROFILE_FORM,
  type FormDefinition, type FormQuestion, type QuestionOption, type QuestionType,
} from "./mentor-form";

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

interface FormStore {
  forms: FormDefinition[];
  applications: Application[];
}

const g = globalThis as unknown as { __formStore?: FormStore };
function mem(): FormStore {
  if (!g.__formStore) {
    g.__formStore = {
      forms: [structuredClone(DEFAULT_MENTOR_FORM), structuredClone(DEFAULT_PROFILE_FORM)],
      applications: [],
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

// Archive by default: submitted answers stay readable. Only a question that
// nothing has answered can be removed outright.
export async function deleteQuestion(id: string, permanent: boolean) {
  if (isDemo()) {
    for (const f of mem().forms) {
      const i = f.questions.findIndex((x) => x.id === id);
      if (i >= 0) {
        if (permanent) f.questions.splice(i, 1);
        else f.questions[i].archived = true;
      }
    }
    return;
  }
  const sb = await supabaseServer();
  if (permanent) await sb.from("form_questions").delete().eq("id", id);
  else await sb.from("form_questions").update({ archived: true }).eq("id", id);
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

export async function submitApplication(
  slug: string, answers: Record<string, unknown>, name: string, email: string, phone: string
) {
  if (isDemo()) {
    mem().applications.unshift({
      id: `app-${Date.now()}`, name, email, phone, answers,
      status: "new", submittedAt: new Date().toISOString(),
    });
    return;
  }
  const sb = await supabaseServer();
  const formId = await formIdFor(slug);
  await sb.from("mentor_applications").insert({
    form_id: formId, name, email, phone, answers, status: "new",
  });
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

export async function needsProfile(userId: string): Promise<boolean> {
  if (isDemo()) return false;
  const sb = await supabaseServer();
  const { data } = await sb.from("users").select("profile_completed_at").eq("id", userId).maybeSingle();
  return !!data && !data.profile_completed_at;
}
