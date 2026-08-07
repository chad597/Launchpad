// Reading and writing the stored report narrative, one row per cohort per
// week. Same demo-or-database seam as lib/weekly.ts.
import { isDemo, supabaseServer } from "./supabase/server";
import type { ReportNarrative } from "./report";

export interface StoredNarrative {
  narrative: ReportNarrative;
  model: string | null;
  generatedAt: string;
}

interface Mem { rows: Map<string, StoredNarrative> }
const g = globalThis as unknown as { __reportStore?: Mem };
const mem = () => (g.__reportStore ??= { rows: new Map() });
const key = (cohortId: string, weekStart: string) => `${cohortId}:${weekStart}`;

export async function getNarrative(
  cohortId: string, weekStart: string
): Promise<StoredNarrative | null> {
  if (isDemo()) return mem().rows.get(key(cohortId, weekStart)) ?? null;
  const sb = await supabaseServer();
  const { data } = await sb
    .from("cohort_reports").select("narrative, model, generated_at")
    .eq("cohort_id", cohortId).eq("week_start", weekStart).maybeSingle();
  if (!data) return null;
  return { narrative: data.narrative, model: data.model ?? null, generatedAt: data.generated_at };
}

export async function saveNarrative(
  cohortId: string, weekStart: string, narrative: ReportNarrative,
  model: string, generatedBy: string
): Promise<void> {
  if (isDemo()) {
    mem().rows.set(key(cohortId, weekStart), {
      narrative, model, generatedAt: new Date().toISOString(),
    });
    return;
  }
  const sb = await supabaseServer();
  await sb.from("cohort_reports").upsert(
    {
      cohort_id: cohortId, week_start: weekStart, narrative, model,
      generated_by: generatedBy, generated_at: new Date().toISOString(),
    },
    { onConflict: "cohort_id,week_start" }
  );
}
