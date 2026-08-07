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

export async function writeNarrative(
  input: unknown
): Promise<{ ok: true; narrative: ReportNarrative } | { ok: false; reason: string }> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return { ok: false, reason: "GEMINI_API_KEY is not set" };

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: INSTRUCTIONS }] },
        contents: [{ role: "user", parts: [{ text: JSON.stringify(input) }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: NARRATIVE_SCHEMA,
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
    const parsed = JSON.parse(text);
    if (!validNarrative(parsed)) return { ok: false, reason: "Narrative did not match the expected shape" };
    return { ok: true, narrative: parsed };
  } catch {
    return { ok: false, reason: "Gemini returned JSON that would not parse" };
  }
}
