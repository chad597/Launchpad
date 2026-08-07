// The narrative layer of the consolidated report, written by Gemini.
//
// Why Gemini: the program runs on Google Workspace and an AI Studio key has
// a free tier that covers a weekly report many times over. Note the trade:
// on the free tier Google may use submitted content to improve its models.
// This report sends founder names, blockers, and topline numbers — no
// contact details, no meeting notes, no conversations. Moving to the paid
// tier turns training use off; the code does not change.
//
// The model is given facts computed in lib/report.ts and asked only to
// write. It is instructed to use no number that is not in its input, and
// the page renders every table from the facts directly, so a hallucinated
// figure has nowhere to hide next to a real one.
import { validNarrative, type ReportNarrative } from "./report";

export const GEMINI_MODEL = "gemini-3.5-flash-lite";

const NARRATIVE_SCHEMA = {
  type: "object",
  properties: {
    executiveSummary: { type: "string" },
    wins: {
      type: "array",
      items: {
        type: "object",
        properties: {
          founder: { type: "string" },
          company: { type: "string", nullable: true },
          what: { type: "string" },
          whyItMatters: { type: "string" },
        },
        required: ["founder", "what", "whyItMatters"],
      },
    },
    challenges: {
      type: "array",
      items: {
        type: "object",
        properties: {
          theme: { type: "string" },
          foundersAffected: { type: "array", items: { type: "string" } },
          detail: { type: "string" },
        },
        required: ["theme", "foundersAffected", "detail"],
      },
    },
    watchList: {
      type: "array",
      items: {
        type: "object",
        properties: { who: { type: "string" }, why: { type: "string" } },
        required: ["who", "why"],
      },
    },
    actions: {
      type: "array",
      items: {
        type: "object",
        properties: { action: { type: "string" }, why: { type: "string" } },
        required: ["action", "why"],
      },
    },
  },
  required: ["executiveSummary", "wins", "challenges", "watchList", "actions"],
};

const INSTRUCTIONS = `You are writing the narrative for a weekly consolidated cohort report at Launchpad Tech Ventures, a startup mentorship program. The reader is program staff deciding who needs help this week.

Rules:
- Use only facts and numbers present in the input. Never invent, estimate, or extrapolate a number. If a value is null, it was not reported; treat it as unknown, never as zero.
- Quote founders' blockers and asks in their own words where they are given.
- executiveSummary: one tight paragraph, most important change first. What moved this week, where the risk is, what staff should do first.
- wins: up to 5, ranked, most meaningful first. A win is something a founder finished or a number that moved, drawn from "shipped", traction, or confidence. whyItMatters is one sentence.
- challenges: cluster the blockers into at most 5 themes. foundersAffected lists names. detail summarizes the theme with one or two direct quotes.
- watchList: founders or pairs that need a human this week — low or falling confidence, short runway, stalled weeks, never filed, no meeting and no plan. One line each on why.
- actions: at most 5 concrete things program staff should do this week, most urgent first, each tied to the data.
- Plain, direct prose. Sentence case. No em dashes. No hype. A quiet week is reported as a quiet week.`;

export function geminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY;
}

// One structured call: instructions + a JSON input, a JSON answer back in
// the given schema. Both the report narrative and the match-rationale polish
// go through here.
async function geminiJson(
  instructions: string, input: unknown, schema: object
): Promise<{ ok: true; value: unknown } | { ok: false; reason: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, reason: "GEMINI_API_KEY is not set" };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: instructions }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(input) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema,
          temperature: 0.4,
        },
      }),
    }
  );

  if (!res.ok) {
    const body = await res.text();
    return { ok: false, reason: `Gemini returned ${res.status}: ${body.slice(0, 300)}` };
  }
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") return { ok: false, reason: "Gemini returned no text" };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, reason: "Gemini returned JSON that would not parse" };
  }
}

export async function writeNarrative(
  input: unknown
): Promise<{ ok: true; narrative: ReportNarrative } | { ok: false; reason: string }> {
  const result = await geminiJson(INSTRUCTIONS, input, NARRATIVE_SCHEMA);
  if (!result.ok) return result;
  if (!validNarrative(result.value)) {
    return { ok: false, reason: "Narrative did not match the expected shape" };
  }
  return { ok: true, narrative: result.value };
}

// The matcher's polish pass, the seam lib/matcher.ts left open. The composed
// rationale is mechanically correct but reads like the scoring engine it
// came from; both people read this text in their introduction, so it is
// worth a rewrite. The model gets the sentences the scoring produced and
// nothing else — same facts, better prose, never new claims.
const RATIONALE_INSTRUCTIONS = `You are rewriting match rationales for a startup mentorship program. Each input item has a founder, a mentor, and factual sentences produced by a scoring engine about why they fit. Rewrite each into a short paragraph (2 to 3 sentences) that will be read by BOTH the founder and the mentor in their introduction email.

Rules:
- Use only facts in the given sentences. Never add skills, history, industries, or numbers that are not stated. If the sentences say there is not enough information, say that plainly.
- Keep any caution the sentences contain; do not soften a real mismatch into praise.
- Warm but plain. Active voice. Sentence case. No em dashes. No hype words.
- Return one rewritten rationale per input item, in the same order.`;

const RATIONALE_SCHEMA = {
  type: "object",
  properties: {
    rationales: { type: "array", items: { type: "string" } },
  },
  required: ["rationales"],
};

export async function polishRationales(
  items: { founder: string; mentor: string; sentences: string }[]
): Promise<{ ok: true; rationales: string[] } | { ok: false; reason: string }> {
  const result = await geminiJson(RATIONALE_INSTRUCTIONS, { items }, RATIONALE_SCHEMA);
  if (!result.ok) return result;
  const r = (result.value as { rationales?: unknown })?.rationales;
  if (!Array.isArray(r) || r.length !== items.length || r.some((x) => typeof x !== "string" || !x.trim())) {
    return { ok: false, reason: "Polish did not return one rationale per candidate" };
  }
  return { ok: true, rationales: r as string[] };
}
