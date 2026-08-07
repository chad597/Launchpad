// The consolidated cohort report: every number computed here, in code.
//
// This file assembles one week of a cohort into a fact sheet — who filed,
// what moved, who met their mentor, what founders asked for — and the page
// renders those facts directly. The narrative that sits on top (executive
// summary, ranked wins, challenge clusters) is written by a model in
// lib/gemini.ts, but it only ever writes prose around numbers assembled
// here. It is never asked to count, sum, or remember; a report whose numbers
// come from a model cannot be argued with, and this one has to be.
//
// The report this replaces was built by exporting HubSpot form answers and
// asking a model to reconstruct the program from them. Its hardest sections
// — was a mentor meeting real, is this founder's second submission a
// duplicate, is that revenue number cumulative — are simply columns here,
// which is most of the improvement.
import {
  cohortHealthBoard, cohortMembers, listPairings, listUsers, meetingsForPairing,
} from "./data";
import { healthRank } from "./health";
import type { Cohort, Meeting, PairHealth, User } from "./types";
import { bandDirection, weekStartOf, weeklyForFounder, type WeeklyUpdate } from "./weekly";

export interface FounderWeek {
  founder: User;
  update: WeeklyUpdate | null;
  // Their filing history, newest first, for the trend read.
  history: WeeklyUpdate[];
  // Weeks filed out of weeks the cohort has been running (capped at 12).
  filedCount: number;
  mentor: User | null;
  // From the meetings table, not self-report: did a meeting complete inside
  // this report's week, and is anything on the books ahead of it.
  metThisWeek: boolean;
  nextMeetingAt: string | null;
  confidenceDelta: number | null;
  hoursDirection: -1 | 0 | 1 | null;
  conversationsDirection: -1 | 0 | 1 | null;
}

export interface ReportFacts {
  cohort: Cohort;
  weekStart: string;
  weekNumber: number;
  founders: FounderWeek[];
  filed: FounderWeek[];
  missing: FounderWeek[];
  neverFiled: FounderWeek[];
  // Mentor engagement, the old report's "focus metric", now from real data.
  metThisWeek: FounderWeek[];
  meetingScheduled: FounderWeek[];
  noMeetingNoPlan: FounderWeek[];
  unmatched: FounderWeek[];
  // Sums over what founders reported this week. Null when nobody answered.
  totals: {
    usersCount: number | null;
    payingCount: number | null;
    revenueCents: number | null;
  };
  avgConfidence: number | null;
  shortRunway: FounderWeek[];
  stalled: FounderWeek[];
  asks: { founder: User; ask: string }[];
  blockers: { founder: User; blocker: string; confidence: number | null }[];
  shipped: { founder: User; shipped: string }[];
  watch: PairHealth[];
}

const WEEK_MS = 7 * 24 * 3600 * 1000;

export function priorWeeks(weekStart: string, count: number): string[] {
  const out: string[] = [];
  for (let i = 1; i <= count; i++) {
    const d = new Date(`${weekStart}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7 * i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function inWeek(m: Meeting, weekStart: string): boolean {
  const start = new Date(`${weekStart}T00:00:00-04:00`).getTime();
  const t = new Date(m.scheduledAt).getTime();
  return t >= start && t < start + WEEK_MS;
}

export async function assembleReport(
  cohort: Cohort, weekStart: string, now: Date
): Promise<ReportFacts> {
  const [users, members, pairings, health] = await Promise.all([
    listUsers(), cohortMembers(cohort.id), listPairings(cohort.id), cohortHealthBoard(),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));

  const founderIds = members.length
    ? members.filter((id) => byId.get(id)?.role === "founder")
    : users.filter((u) => u.role === "founder" && u.status !== "inactive").map((u) => u.id);

  const active = pairings.filter((p) => p.status === "active");
  const mentorOf = new Map(active.map((p) => [p.founderId, byId.get(p.mentorId) ?? null]));
  const pairingOf = new Map(active.map((p) => [p.founderId, p]));

  const weeksRunning = Math.max(1, Math.min(12,
    Math.floor((now.getTime() - new Date(cohort.startDate).getTime()) / WEEK_MS) + 1));

  const nowIso = now.toISOString();
  const founders: FounderWeek[] = [];
  for (const id of founderIds) {
    const founder = byId.get(id);
    if (!founder || founder.status === "inactive") continue;

    const history = await weeklyForFounder(id, 12);
    const update = history.find((u) => u.weekStart === weekStart) ?? null;
    const prior = history.find((u) => u.weekStart < weekStart) ?? null;

    const pairing = pairingOf.get(id);
    let metThisWeek = false;
    let nextMeetingAt: string | null = null;
    if (pairing) {
      const meetings = await meetingsForPairing(pairing.id);
      metThisWeek = meetings.some((m) => m.status === "completed" && inWeek(m, weekStart));
      nextMeetingAt = meetings.find((m) => m.status === "scheduled" && m.scheduledAt >= nowIso)
        ?.scheduledAt ?? null;
    }

    founders.push({
      founder, update, history,
      filedCount: history.filter((u) => u.weekStart <= weekStart).length,
      mentor: mentorOf.get(id) ?? null,
      metThisWeek, nextMeetingAt,
      confidenceDelta: update?.confidence != null && prior?.confidence != null
        ? update.confidence - prior.confidence : null,
      hoursDirection: bandDirection("hours", update?.hours ?? null, prior?.hours ?? null),
      conversationsDirection:
        bandDirection("conversations", update?.conversations ?? null, prior?.conversations ?? null),
    });
  }

  const filed = founders.filter((f) => f.update)
    .sort((a, b) => (a.update!.confidence ?? 99) - (b.update!.confidence ?? 99));
  const missing = founders.filter((f) => !f.update);
  const neverFiled = founders.filter((f) => f.history.length === 0);

  const matched = founders.filter((f) => f.mentor);
  const sum = (pick: (u: WeeklyUpdate) => number | null): number | null => {
    const vals = filed.map((f) => pick(f.update!)).filter((v): v is number => v != null);
    return vals.length ? vals.reduce((s, v) => s + v, 0) : null;
  };
  const confidences = filed.map((f) => f.update!.confidence).filter((c): c is number => c != null);

  return {
    cohort, weekStart, weekNumber: weeksRunning, founders, filed, missing, neverFiled,
    metThisWeek: matched.filter((f) => f.metThisWeek),
    meetingScheduled: matched.filter((f) => !f.metThisWeek && f.nextMeetingAt),
    noMeetingNoPlan: matched.filter((f) => !f.metThisWeek && !f.nextMeetingAt),
    unmatched: founders.filter((f) => !f.mentor),
    totals: {
      usersCount: sum((u) => u.usersCount),
      payingCount: sum((u) => u.payingCount),
      revenueCents: sum((u) => u.revenueCents),
    },
    avgConfidence: confidences.length
      ? Math.round((confidences.reduce((s, c) => s + c, 0) / confidences.length) * 10) / 10
      : null,
    shortRunway: filed.filter((f) => f.update!.runway === "under_3"),
    stalled: filed.filter(
      (f) => f.update!.hours === "none" || f.update!.hours === "under_5" || f.update!.conversations === "0"
    ),
    asks: filed.filter((f) => f.update!.ask)
      .map((f) => ({ founder: f.founder, ask: f.update!.ask! })),
    blockers: filed.filter((f) => f.update!.blocker)
      .map((f) => ({ founder: f.founder, blocker: f.update!.blocker!, confidence: f.update!.confidence })),
    shipped: filed.filter((f) => f.update!.shipped)
      .map((f) => ({ founder: f.founder, shipped: f.update!.shipped! })),
    watch: health.filter((h) => h.health !== "healthy").sort((a, b) => healthRank(a.health) - healthRank(b.health)),
  };
}

// What the model is given to write from — the facts above, flattened to the
// things prose can be written about, with ids so the page can link names.
export function narrativeInput(facts: ReportFacts) {
  const f = (x: FounderWeek) => ({
    name: x.founder.name, company: x.founder.company ?? null,
  });
  return {
    program: "Launchpad Tech Ventures 1:1 mentorship",
    cohort: facts.cohort.name,
    ecosystem: facts.cohort.ecosystem,
    weekNumber: facts.weekNumber, weekOf: facts.weekStart,
    founders: facts.founders.length,
    filed: facts.filed.length,
    missing: facts.missing.map(f),
    neverFiled: facts.neverFiled.map(f),
    mentorEngagement: {
      metThisWeek: facts.metThisWeek.length,
      meetingScheduled: facts.meetingScheduled.length,
      noMeetingNoPlan: facts.noMeetingNoPlan.map(f),
      unmatched: facts.unmatched.map(f),
    },
    totals: {
      activeUsers: facts.totals.usersCount,
      payingCustomers: facts.totals.payingCount,
      revenueDollars: facts.totals.revenueCents == null ? null : facts.totals.revenueCents / 100,
    },
    averageConfidence: facts.avgConfidence,
    perFounder: facts.filed.map((x) => ({
      ...f(x),
      confidence: x.update!.confidence,
      confidenceDelta: x.confidenceDelta,
      hours: x.update!.hours, hoursDirection: x.hoursDirection,
      conversations: x.update!.conversations, conversationsDirection: x.conversationsDirection,
      runway: x.update!.runway,
      shipped: x.update!.shipped, blocker: x.update!.blocker, ask: x.update!.ask,
      users: x.update!.usersCount, paying: x.update!.payingCount,
      revenueDollars: x.update!.revenueCents == null ? null : x.update!.revenueCents / 100,
      metMentorThisWeek: x.metThisWeek,
      mentor: x.mentor?.name ?? null,
    })),
    pairsNeedingAttention: facts.watch.map((h) => ({
      founder: h.founder.name, mentor: h.mentor.name, level: h.health, signal: h.signal,
    })),
  };
}

// The narrative the model returns, and the shape the page renders. Stored as
// jsonb so a regenerate replaces it wholesale.
export interface ReportNarrative {
  executiveSummary: string;
  wins: { founder: string; company: string | null; what: string; whyItMatters: string }[];
  challenges: { theme: string; foundersAffected: string[]; detail: string }[];
  watchList: { who: string; why: string }[];
  actions: { action: string; why: string }[];
}

export function validNarrative(x: unknown): x is ReportNarrative {
  if (!x || typeof x !== "object") return false;
  const n = x as Record<string, unknown>;
  return typeof n.executiveSummary === "string" &&
    Array.isArray(n.wins) && Array.isArray(n.challenges) &&
    Array.isArray(n.watchList) && Array.isArray(n.actions);
}

// A narrative composed without a model, used when no GEMINI_API_KEY is set.
// Flat but honest: the same sections, straight from the facts, so the report
// is usable before any key exists and the model's version can be compared
// against something.
export function composeFallback(facts: ReportFacts): ReportNarrative {
  const parts: string[] = [];
  parts.push(`${facts.filed.length} of ${facts.founders.length} founders filed for the week of ${facts.weekStart}, week ${facts.weekNumber} of 12.`);
  if (facts.metThisWeek.length || facts.meetingScheduled.length) {
    parts.push(`${facts.metThisWeek.length} met their mentor this week and ${facts.meetingScheduled.length} more have a meeting booked; ${facts.noMeetingNoPlan.length} have neither.`);
  }
  if (facts.avgConfidence != null) parts.push(`Average confidence is ${facts.avgConfidence} of 10.`);
  if (facts.shortRunway.length) {
    parts.push(`${facts.shortRunway.map((f) => f.founder.name).join(", ")} reported under 3 months of runway.`);
  }
  if (facts.missing.length) {
    parts.push(`Nothing filed from ${facts.missing.map((f) => f.founder.name).join(", ")} — usually the first people to call.`);
  }

  const wins = facts.shipped.slice(0, 5).map((s) => ({
    founder: s.founder.name, company: s.founder.company ?? null,
    what: s.shipped, whyItMatters: "Finished this week, in the founder's own words.",
  }));

  const challenges = facts.blockers.length
    ? [{
        theme: "What founders say is in their way",
        foundersAffected: facts.blockers.map((b) => b.founder.name),
        detail: facts.blockers.slice(0, 3).map((b) => `${b.founder.name.split(" ")[0]}: "${b.blocker}"`).join(" "),
      }]
    : [];

  const watchList = [
    ...facts.watch.slice(0, 5).map((h) => ({
      who: `${h.founder.name} and ${h.mentor.name}`, why: h.signal,
    })),
    ...facts.neverFiled.map((f) => ({
      who: f.founder.name, why: "Has never filed a weekly update.",
    })),
  ];

  const actions: ReportNarrative["actions"] = [];
  if (facts.missing.length) actions.push({
    action: `Chase this week's update from ${facts.missing.map((f) => f.founder.name.split(" ")[0]).join(", ")}`,
    why: "A missing update is the strongest signal the form produces.",
  });
  if (facts.noMeetingNoPlan.length) actions.push({
    action: "Get a meeting booked for every pair with nothing on the calendar",
    why: `${facts.noMeetingNoPlan.length} matched founders have no meeting and no plan.`,
  });
  if (facts.asks.length) actions.push({
    action: "Work through the asks list",
    why: `${facts.asks.length} founders asked Launchpad for something specific this week.`,
  });

  return {
    executiveSummary: parts.join(" "),
    wins, challenges, watchList, actions,
  };
}

export { weekStartOf };
