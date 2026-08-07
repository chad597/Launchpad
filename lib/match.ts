// Why a pairing is a pairing, scored from what both people actually answered.
//
// Nothing here creates a match. It reads a founder and a mentor and explains,
// criterion by criterion, how well their answers line up, so an admin can look
// at a pairing and see the reasoning rather than take it on trust. The same
// scoring runs the shortlist when the matcher is built, which is why it lives
// in its own file rather than inside the report page.
//
// Two rules the whole file obeys:
//
//   Unanswered is not zero. A criterion neither side answered scores null and
//   drops out of the total, and the report says how much of the picture it
//   could see. Scoring silence as a bad fit would make an unfinished intake
//   look like a bad match.
//
//   Every number carries a sentence. A score with no explanation is worse than
//   no score, because it looks authoritative.
import {
  INDUSTRY_OPTIONS, SKILL_OPTIONS, TIME_ZONE_OPTIONS, type QuestionOption,
} from "./mentor-form";
import {
  COMMITMENT_OPTIONS, FOUNDER_FORMAT_OPTIONS, FOUNDER_STAGE_OPTIONS,
  INDUSTRY_PREF_OPTIONS, TEAM_OPTIONS,
} from "./founder-form";
import type { User } from "./types";

// Rank positions on both sides, agreed with the program: the first answer
// carries the match, the second is worth having, the third is a bonus.
export const RANK_WEIGHTS = [1, 0.6, 0.35];

export interface CriterionResult {
  key: string;
  label: string;
  // 0 to 5, or null when neither side gave us enough to judge it.
  score: number | null;
  // How much this criterion counts toward the total. Zero when it did not
  // score at all.
  weight: number;
  // One line, written to be read by a person deciding whether to keep the
  // pairing. Present even when the score is null.
  note: string;
}

export interface MatchScore {
  // 0 to 100, or null when nothing at all could be scored.
  total: number | null;
  criteria: CriterionResult[];
  // How much of the picture the score is based on.
  scored: number;
  of: number;
  // Things an admin should see before the score: a hard conflict, a mentor
  // over capacity, an intake nobody has filled in.
  warnings: string[];
}

const labelOf = (options: QuestionOption[], value?: string) =>
  (value && options.find((o) => o.value === value)?.label) || null;

export const skillLabel = (v: string) => labelOf(SKILL_OPTIONS, v) ?? v;
export const industryLabel = (v: string) => labelOf(INDUSTRY_OPTIONS, v) ?? v;
export const timeZoneLabel = (v: string) => labelOf(TIME_ZONE_OPTIONS, v) ?? v;
export const stageLabel = (v: string) => labelOf(FOUNDER_STAGE_OPTIONS, v) ?? v;
export const formatLabel = (v: string) => labelOf(FOUNDER_FORMAT_OPTIONS, v) ?? v;
export const teamLabel = (v: string) => labelOf(TEAM_OPTIONS, v) ?? v;
export const commitmentLabel = (v: string) => labelOf(COMMITMENT_OPTIONS, v) ?? v;
export const industryPrefLabel = (v: string) => labelOf(INDUSTRY_PREF_OPTIONS, v) ?? v;

export const MENTOR_STAGE_LABELS: Record<string, string> = {
  idea: "Idea and pre-product",
  first_customers: "Just got their first customers",
  both: "Both",
  no_preference: "No preference",
};

// The same answers again, worded to sit inside a sentence rather than in a
// field label, because the notes on this page are meant to be read aloud.
const MENTOR_STAGE_PHRASE: Record<string, string> = {
  idea: "founders with an idea and nothing built",
  first_customers: "founders who have just got their first customers",
};

const FOUNDER_STAGE_PHRASE: Record<string, string> = {
  idea: "sitting on an idea with nothing built",
  building: "building it, not launched",
  first_customers: "launched and working on first customers",
  revenue: "taking paying customers and working on growth",
};

const INDUSTRY_PREF_PHRASE: Record<string, string> = {
  a_lot: "said that matters a lot",
  somewhat: "said it matters somewhat",
  not_much: "said the problem matters more than the industry",
};

export const BACKGROUND_LABELS: Record<string, string> = {
  founded: "Founded or co-founded a company",
  exited: "Exited a company",
  pnl: "Ran a P&L or business unit",
  operator: "Early employee or senior operator",
  sme: "Deep expertise in one area",
};

// An answered list. A required ranked question that arrives empty means the
// person never got there, not that they chose nothing.
function ranked(list?: string[]): string[] | null {
  return list && list.length ? list : null;
}

const first = (name: string) => name.split(" ")[0];

// Where a founder is today, in the two buckets a mentor picked between.
function stageBucket(founderStage?: string): "idea" | "first_customers" | null {
  if (founderStage === "idea" || founderStage === "building") return "idea";
  if (founderStage === "first_customers" || founderStage === "revenue") return "first_customers";
  return null;
}

interface Context {
  // Active pairings this mentor already has, including this one.
  mentorLoad?: number;
}

export function scorePair(founder: User, mentor: User, ctx: Context = {}): MatchScore {
  const f = first(founder.name);
  const m = first(mentor.name);
  const needs = ranked(founder.needs);
  const skills = ranked(mentor.skills);
  const warnings: string[] = [];

  const criteria: CriterionResult[] = [];
  const add = (key: string, label: string, weight: number, score: number | null, note: string) =>
    criteria.push({ key, label, weight: score == null ? 0 : weight, score, note });

  // 1. The thing they said matters most.
  if (!needs) {
    add("top_need", "Top need", 25, null, `${f} has not said what they need help with yet.`);
  } else if (!skills) {
    add("top_need", "Top need", 25, null, `${m} has not ranked what they can help with yet.`);
  } else {
    const need = needs[0];
    const at = skills.indexOf(need);
    const score = at === 0 ? 5 : at === 1 ? 4 : at === 2 ? 3 : 0;
    add("top_need", "Top need", 25, score,
      at < 0
        ? `${f} needs ${skillLabel(need).toLowerCase()} most, and ${m} did not list it at all.`
        : at === 0
          ? `${f} needs ${skillLabel(need).toLowerCase()} most, and it is the first thing ${m} offers.`
          : `${f} needs ${skillLabel(need).toLowerCase()} most, and ${m} ranked it ${at + 1}${at === 1 ? "nd" : "rd"}.`);
  }

  // 2. What they asked for after that. Ranked on both sides, so a second need
  //    met by a mentor's third skill still counts, just for less.
  const others = needs?.slice(1) ?? [];
  if (!needs || !skills) {
    add("other_needs", "Other needs", 15, null, "Both sides have to answer before this can be scored.");
  } else if (!others.length) {
    add("other_needs", "Other needs", 15, null, `${f} named one need only.`);
  } else {
    let got = 0, possible = 0;
    const covered: string[] = [], missed: string[] = [];
    others.forEach((need, i) => {
      const w = RANK_WEIGHTS[i + 1] ?? 0.35;
      possible += w;
      if (skills.includes(need)) { got += w; covered.push(skillLabel(need).toLowerCase()); }
      else missed.push(skillLabel(need).toLowerCase());
    });
    let score = possible ? (5 * got) / possible : null;
    // A mentor whose strongest skill is the one thing the founder already has
    // covered is a weaker match than the arithmetic suggests.
    const spent = founder.strengths?.includes(skills[0]) ? skills[0] : null;
    if (score != null && spent) score = Math.max(0, score - 1);
    add("other_needs", "Other needs", 15, score == null ? null : Math.round(score * 10) / 10,
      [
        covered.length ? `${m} also covers ${covered.join(" and ")}.` : `${m} covers neither of the other things ${f} asked for.`,
        missed.length && covered.length ? `Nothing on ${missed.join(" or ")}.` : "",
        spent ? `Their strongest skill, ${skillLabel(spent).toLowerCase()}, is something ${f} already has covered.` : "",
      ].filter(Boolean).join(" "));
  }

  // 3. The hard filter. A founder's biggest problem should not land with
  //    someone who told us they would rather not be the go-to for it.
  const avoid = mentor.avoidSkills;
  if (!needs || avoid === undefined) {
    add("avoid", "Nothing they avoid", 15, null,
      avoid === undefined ? `${m} has not filled in their profile.` : `${f} has not said what they need yet.`);
  } else {
    const hit = needs.findIndex((n) => avoid.includes(n));
    const score = hit < 0 ? 5 : hit === 0 ? 0 : hit === 1 ? 2 : 3;
    if (hit === 0) {
      warnings.push(`${m} would rather not be the go-to for ${skillLabel(needs[0]).toLowerCase()}, which is exactly what ${f} asked for first.`);
    }
    add("avoid", "Nothing they avoid", 15, score,
      hit < 0
        ? `Nothing ${f} asked for is on ${m}'s list of things they would rather not take on.`
        : `${m} would rather not be the go-to for ${skillLabel(needs[hit]).toLowerCase()}, which is ${f}'s number ${hit + 1}.`);
  }

  // 4. Same world. How hard this counts is the founder's own call, so their
  //    answer sets the weight rather than the score.
  const pref = founder.industryPref;
  const weightForIndustry = pref === "a_lot" ? 15 : pref === "not_much" ? 5 : 10;
  const fIndustry = founder.industries?.[0];
  const mIndustries = mentor.industries;
  if (!fIndustry || !mIndustries?.length) {
    add("industry", "Same world", weightForIndustry, null, "One of them has not told us their industry.");
  } else {
    const overlap = mIndustries.includes(fIndustry);
    add("industry", "Same world", weightForIndustry, overlap ? 5 : 1,
      `${f} is building in ${industryLabel(fIndustry).toLowerCase()}, ${overlap ? `and ${m} has operated there` : `which is not somewhere ${m} has operated`}. ${pref ? `${f} ${INDUSTRY_PREF_PHRASE[pref]}` : "How much that matters is unanswered"}.`);
  }

  // 5. Where the founder is, against where the mentor said they are useful.
  const bucket = stageBucket(founder.founderStage);
  const stagePref = mentor.stagePreference;
  if (!bucket || !stagePref) {
    add("stage", "Where they are", 10, null, "Stage is unanswered on one side.");
  } else if (stagePref === "both" || stagePref === "no_preference") {
    add("stage", "Where they are", 10, 4,
      `${m} works with founders at any stage, and ${f} is ${FOUNDER_STAGE_PHRASE[founder.founderStage!]}.`);
  } else {
    add("stage", "Where they are", 10, stagePref === bucket ? 5 : 2,
      `${f} is ${FOUNDER_STAGE_PHRASE[founder.founderStage!]}. ${m} is most useful with ${MENTOR_STAGE_PHRASE[stagePref]}.`);
  }

  // 6. How each of them wants the relationship to run. Same values on both
  //    forms, different labels, because each side describes it from their
  //    own chair.
  const ff = founder.mentoringFormat, mf = mentor.mentoringFormat;
  if (!ff || !mf) {
    add("format", "Way of working", 10, null, "One of them has not said how they want to work.");
  } else if (ff === mf) {
    add("format", "Way of working", 10, 5, `Both of them chose ${formatLabel(ff).toLowerCase()}.`);
  } else if (ff === "depends" || mf === "depends") {
    add("format", "Way of working", 10, 4,
      `${ff === "depends" ? f : m} is open on format; the other asked for ${formatLabel(ff === "depends" ? mf : ff).toLowerCase()}.`);
  } else {
    add("format", "Way of working", 10, 2,
      `${f} wants ${formatLabel(ff).toLowerCase()}; ${m} works ${formatLabel(mf).toLowerCase()}.`);
  }

  // 7. Whether booking a meeting will be a fight.
  const ftz = founder.timeZone, mtz = mentor.timeZone;
  if (!ftz || !mtz) {
    add("time", "Time and place", 8, null, "Time zone is missing on one side.");
  } else {
    add("time", "Time and place", 8, ftz === mtz ? 5 : 2,
      ftz === mtz
        ? `Both in ${timeZoneLabel(ftz).toLowerCase()} time.`
        : `${f} is ${timeZoneLabel(ftz).toLowerCase()}, ${m} is ${timeZoneLabel(mtz).toLowerCase()}.`);
  }

  // 8. Whether the mentor has room for this founder.
  const cap = mentor.capacity ?? 1;
  const load = ctx.mentorLoad ?? 1;
  const roomScore = load < cap ? 5 : load === cap ? 3 : 1;
  if (load > cap) warnings.push(`${m} is carrying ${load} founders against a stated capacity of ${cap}.`);
  add("room", "Room for this", 5, roomScore,
    load > cap
      ? `${m} is over the ${cap} they said they could take.`
      : load === cap
        ? `${m} is at their stated capacity of ${cap}.`
        : `${m} is carrying ${load} of ${cap}.`);

  const scored = criteria.filter((c) => c.score != null);
  const denom = scored.reduce((s, c) => s + c.weight * 5, 0);
  const total = denom ? Math.round((100 * scored.reduce((s, c) => s + c.weight * (c.score as number), 0)) / denom) : null;

  if (!needs) warnings.push(`${f} has not filled in the intake form.`);
  if (!skills) warnings.push(`${m} has no ranked skills on file.`);

  return { total, criteria, scored: scored.length, of: criteria.length, warnings };
}

// The four or five lines worth reading first: the criteria that moved the
// score, strongest and weakest, rather than all eight in form order.
export function headlines(score: MatchScore, limit = 4): CriterionResult[] {
  const scored = score.criteria.filter((c) => c.score != null);
  const strong = [...scored].sort((a, b) => (b.score! * b.weight) - (a.score! * a.weight));
  const weak = [...scored].sort((a, b) => a.score! - b.score!).filter((c) => c.score! <= 2);
  const picked: CriterionResult[] = [];
  for (const c of [...weak, ...strong]) {
    if (picked.length >= limit) break;
    if (!picked.includes(c)) picked.push(c);
  }
  return picked;
}

export function scoreBand(score: number | null): "strong" | "fair" | "weak" | "unknown" {
  if (score == null) return "unknown";
  if (score >= 4) return "strong";
  if (score >= 3) return "fair";
  return "weak";
}

export function totalBand(total: number | null): "strong" | "fair" | "weak" | "unknown" {
  if (total == null) return "unknown";
  if (total >= 75) return "strong";
  if (total >= 55) return "fair";
  return "weak";
}
