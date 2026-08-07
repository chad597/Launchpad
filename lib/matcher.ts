// The matcher: hard filters, then the weighted score, then a ranked
// shortlist of five written to match_suggestions. Chad makes the final call
// from the shortlist; nothing in this file creates a pairing.
//
// The scoring is lib/match.ts, unchanged — the same numbers and sentences
// the match report shows for existing pairings, so a suggestion and the
// pairing it becomes never disagree about why.
//
// One hard filter, agreed with the program: a mentor whose avoid list
// contains the founder's number one need is out, not just scored down. A
// founder's biggest problem should never land with someone who told us they
// would rather not be the go-to for it. Capacity is not a hard filter — a
// full mentor ranks lower and carries a warning, but the final call belongs
// to the person reading the list.
import { headlines, scorePair, skillLabel, type MatchScore } from "./match";
import type { User } from "./types";

export interface ShortlistEntry {
  mentor: User;
  rank: number; // 1 is the best we found
  score: MatchScore;
  // Current active pairings this mentor holds, counting this prospective one.
  load: number;
  breakdown: string[];
  rationale: string;
}

export interface ShortlistResult {
  shortlist: ShortlistEntry[];
  // Mentors the hard filter removed, so the page can say who and why rather
  // than have them silently missing.
  excluded: { mentor: User; reason: string }[];
  // How many mentors were actually scored.
  considered: number;
}

export const SHORTLIST_SIZE = 5;

// Chips for the shortlist row: the criteria that moved the score, marked by
// how they landed, plus how much of the picture the score could see.
function chips(score: MatchScore): string[] {
  const out = headlines(score, 4).map((c) => {
    const s = c.score as number;
    return `${c.label} ${s >= 4 ? "✓" : s >= 3 ? "·" : "✗"}`;
  });
  if (score.scored < score.of) out.push(`Based on ${score.scored} of ${score.of}`);
  return out;
}

// The rationale both people will read in their intro if this suggestion is
// confirmed, composed from the scoring sentences. This is the seam where an
// LLM polish pass would slot in: same inputs, better prose, never new facts.
function composeRationale(score: MatchScore): string {
  const strong = score.criteria
    .filter((c) => c.score != null && c.score >= 4)
    .sort((a, b) => b.weight * (b.score as number) - a.weight * (a.score as number))
    .slice(0, 3)
    .map((c) => c.note);
  const caution = score.criteria
    .filter((c) => c.score != null && c.score <= 2)
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 1)
    .map((c) => c.note);
  return [...strong, ...caution].join(" ") || "Not enough answers on either side to say much yet.";
}

export function buildShortlist(
  founder: User,
  candidates: User[],
  // Active pairings per mentor across all cohorts, before this match.
  loads: Map<string, number>,
): ShortlistResult {
  const excluded: ShortlistResult["excluded"] = [];
  const scored: { mentor: User; score: MatchScore; load: number }[] = [];

  const topNeed = founder.needs?.[0];
  for (const mentor of candidates) {
    if (mentor.status === "inactive" || mentor.role !== "mentor") continue;

    if (topNeed && mentor.avoidSkills?.includes(topNeed)) {
      excluded.push({
        mentor,
        reason: `would rather not be the go-to for ${skillLabel(topNeed).toLowerCase()}, which is ${founder.name.split(" ")[0]}'s number 1`,
      });
      continue;
    }

    const load = (loads.get(mentor.id) ?? 0) + 1;
    scored.push({ mentor, load, score: scorePair(founder, mentor, { mentorLoad: load }) });
  }

  // Best first. A candidate nothing could be scored against sits at the
  // bottom rather than out of the list, because an empty profile is a reason
  // to chase the profile, not to hide the mentor.
  scored.sort((a, b) => (b.score.total ?? -1) - (a.score.total ?? -1));

  const shortlist = scored.slice(0, SHORTLIST_SIZE).map((c, i) => ({
    ...c,
    rank: i + 1,
    breakdown: chips(c.score),
    rationale: composeRationale(c.score),
  }));

  return { shortlist, excluded, considered: scored.length };
}
