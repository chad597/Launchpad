// Reading and writing the weekly founder update.
//
// One row per founder per week. Re-filing the same week edits that row, so a
// founder who remembers a number on Thursday does not create a second entry
// and a false trend. Follows the same demo-or-database seam as lib/forms.ts.
import { isDemo, supabaseServer } from "./supabase/server";
import { CONVERSATION_RANK, HOURS_RANK, RUNWAY_RANK, WEEKLY_LABELS } from "./weekly-form";
import { DEMO_WEEKLY_UPDATES } from "./fixtures";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface WeeklyUpdate {
  id: string;
  founderId: string;
  cohortId: string | null;
  weekStart: string;     // ISO date, the Monday the week began
  weekNumber: number | null;
  hours: string | null;
  conversations: string | null;
  runway: string | null;
  shipped: string | null;
  usersCount: number | null;
  payingCount: number | null;
  revenueCents: number | null;
  confidence: number | null;
  blocker: string | null;
  ask: string | null;
  answers: Record<string, unknown>;
  submittedAt: string;
}

// The Monday of the week a moment falls in, in Eastern time, because the
// program runs on Eastern and a founder filing on Sunday night in Pacific
// should still be filing for the week they just worked.
export function weekStartOf(now: Date = new Date()): string {
  const eastern = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
  const dow = (eastern.getDay() + 6) % 7; // Monday = 0
  eastern.setDate(eastern.getDate() - dow);
  const y = eastern.getFullYear();
  const m = String(eastern.getMonth() + 1).padStart(2, "0");
  const d = String(eastern.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function weekStartLabel(weekStart: string): string {
  return new Date(`${weekStart}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short", day: "numeric", timeZone: "America/New_York",
  });
}

// A number a founder typed, which may be blank, may have a dollar sign, and
// may have commas in it. Blank stays blank: it means they have nothing to
// count yet, which is not the same as zero.
export function parseCount(v: unknown): number | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const n = Number(v.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? Math.round(n) : null;
}

export function parseMoneyCents(v: unknown): number | null {
  if (typeof v !== "string" || !v.trim()) return null;
  const n = Number(v.replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export const money = (cents: number | null | undefined) =>
  cents == null ? null : `$${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;

export const bandLabel = (key: "hours" | "conversations" | "runway", value: string | null) =>
  (value && WEEKLY_LABELS[key]?.[value]) || null;

// Whether a band answer moved up, down, or stayed put against last week.
export function bandDirection(
  key: "hours" | "conversations" | "runway", now: string | null, before: string | null
): -1 | 0 | 1 | null {
  const rank = key === "hours" ? HOURS_RANK : key === "conversations" ? CONVERSATION_RANK : RUNWAY_RANK;
  if (!now || !before || rank[now] === undefined || rank[before] === undefined) return null;
  return rank[now] === rank[before] ? 0 : rank[now] > rank[before] ? 1 : -1;
}

function mapRow(r: any): WeeklyUpdate {
  return {
    id: r.id, founderId: r.founder_id, cohortId: r.cohort_id ?? null,
    weekStart: r.week_start, weekNumber: r.week_number ?? null,
    hours: r.hours ?? null, conversations: r.conversations ?? null, runway: r.runway ?? null,
    shipped: r.shipped ?? null,
    usersCount: r.users_count ?? null, payingCount: r.paying_count ?? null,
    revenueCents: r.revenue_cents ?? null, confidence: r.confidence ?? null,
    blocker: r.blocker ?? null, ask: r.ask ?? null,
    answers: r.answers ?? {}, submittedAt: r.submitted_at,
  };
}

interface WeeklyStore { updates: WeeklyUpdate[] }
const g = globalThis as unknown as { __weeklyStore?: WeeklyStore };
function mem(): WeeklyStore {
  if (!g.__weeklyStore) g.__weeklyStore = { updates: structuredClone(DEMO_WEEKLY_UPDATES) };
  return g.__weeklyStore;
}

// Newest first.
export async function weeklyForFounder(founderId: string, limit = 12): Promise<WeeklyUpdate[]> {
  if (isDemo()) {
    return mem().updates
      .filter((u) => u.founderId === founderId)
      .sort((a, b) => b.weekStart.localeCompare(a.weekStart))
      .slice(0, limit);
  }
  const sb = await supabaseServer();
  const { data } = await sb
    .from("weekly_updates").select("*").eq("founder_id", founderId)
    .order("week_start", { ascending: false }).limit(limit);
  return (data ?? []).map(mapRow);
}

export async function weeklyForWeek(founderId: string, weekStart: string): Promise<WeeklyUpdate | null> {
  if (isDemo()) {
    return mem().updates.find((u) => u.founderId === founderId && u.weekStart === weekStart) ?? null;
  }
  const sb = await supabaseServer();
  const { data } = await sb
    .from("weekly_updates").select("*")
    .eq("founder_id", founderId).eq("week_start", weekStart).maybeSingle();
  return data ? mapRow(data) : null;
}

// Everything filed for one week, for the staff roll-up.
export async function weeklyForCohort(cohortId: string, weekStart: string): Promise<WeeklyUpdate[]> {
  if (isDemo()) return mem().updates.filter((u) => u.weekStart === weekStart);
  const sb = await supabaseServer();
  const { data } = await sb
    .from("weekly_updates").select("*").eq("cohort_id", cohortId).eq("week_start", weekStart);
  return (data ?? []).map(mapRow);
}

// Every answer key any founder has ever filed, for the form editor's
// hard-delete guard: a weekly question with answers behind it can only be
// archived.
export async function weeklyAnsweredKeys(): Promise<Set<string>> {
  const keys = new Set<string>();
  const collect = (answers: Record<string, unknown>) => {
    for (const [k, v] of Object.entries(answers)) {
      if (v != null && v !== "" && !(Array.isArray(v) && v.length === 0)) keys.add(k);
    }
  };
  if (isDemo()) {
    for (const u of mem().updates) collect(u.answers);
    return keys;
  }
  const sb = await supabaseServer();
  const { data } = await sb.from("weekly_updates").select("answers");
  for (const r of data ?? []) collect((r as { answers: Record<string, unknown> }).answers ?? {});
  return keys;
}

export interface WeeklyInput {
  founderId: string;
  cohortId: string | null;
  weekStart: string;
  weekNumber: number | null;
  answers: Record<string, unknown>;
}

// The typed columns are a copy of the answers the program reads as a series.
// Anything an admin adds to the form later lives in `answers` alone and still
// renders, the same as the intake forms.
export async function saveWeekly(input: WeeklyInput): Promise<void> {
  const a = input.answers as Record<string, any>;
  const row = {
    founder_id: input.founderId,
    cohort_id: input.cohortId,
    week_start: input.weekStart,
    week_number: input.weekNumber,
    hours: a.hours || null,
    conversations: a.conversations || null,
    runway: a.runway || null,
    shipped: typeof a.shipped === "string" && a.shipped.trim() ? a.shipped.trim() : null,
    users_count: parseCount(a.users_count),
    paying_count: parseCount(a.paying_count),
    revenue_cents: parseMoneyCents(a.revenue),
    confidence: a.confidence ? Number(a.confidence) : null,
    blocker: typeof a.blocker === "string" && a.blocker.trim() ? a.blocker.trim() : null,
    ask: typeof a.ask === "string" && a.ask.trim() ? a.ask.trim() : null,
    answers: input.answers,
  };

  if (isDemo()) {
    const store = mem();
    const existing = store.updates.find(
      (u) => u.founderId === input.founderId && u.weekStart === input.weekStart
    );
    const mapped = mapRow({ ...row, id: existing?.id ?? `wk-${Date.now()}`, submitted_at: existing?.submittedAt ?? new Date().toISOString() });
    if (existing) Object.assign(existing, mapped);
    else store.updates.push(mapped);
    return;
  }

  const sb = await supabaseServer();
  await sb.from("weekly_updates").upsert(
    { ...row, updated_at: new Date().toISOString() },
    { onConflict: "founder_id,week_start" }
  );
}

// What to put back in the boxes when the form opens: this week's answers if
// they already filed, otherwise last week's, so a typical week is a scan and
// a submit. The three questions that describe this week specifically start
// empty either way, because carrying them forward would invite a founder to
// leave last week's answer standing.
export function prefillFrom(thisWeek: WeeklyUpdate | null, lastWeek: WeeklyUpdate | null): Record<string, unknown> {
  if (thisWeek) return thisWeek.answers;
  if (!lastWeek) return {};
  const { shipped, blocker, ask, needs_changed, ...carried } = lastWeek.answers as Record<string, unknown>;
  void shipped; void blocker; void ask; void needs_changed;
  return carried;
}
