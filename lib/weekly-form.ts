// The weekly founder update, rebuilt.
//
// The form it replaces asked twenty-one questions and got answered by almost
// nobody, for a reason worth writing down: eleven of them asked for something
// the program already held. Email, company name, website, one-sentence
// description, co-founder count and pitch deck are all on the intake form and
// do not change week to week. Three more asked whether the founder met their
// mentor and why not, which the meetings table and the mentor's half of the
// meeting note already answer, and answer more honestly. Two asked in
// different words what other mentorship they wanted, which the intake form
// ranks. One asked how complete the MVP was, as a number nobody could define
// the same way twice.
//
// What is left here is the part that changes weekly and that nothing else in
// the app can see. Every question either draws a line over time or puts
// something in front of staff to act on. Nine of the eleven are one click,
// and the form opens with last week's numbers already in the boxes, so a
// typical week is a scan and a submit.
//
// One question is deliberately kept from the old form: the biggest challenge,
// now asked as what is in your way. It is the question mentors say they read
// first.
import { SKILL_OPTIONS, type FormDefinition, type FormQuestion, type QuestionOption } from "./mentor-form";

// Hours matter more than any revenue number at this stage, because most of
// these companies are pre-revenue and a week with no hours in it is the
// earliest warning the program ever gets.
export const HOURS_OPTIONS: QuestionOption[] = [
  { value: "none", label: "None this week" },
  { value: "under_5", label: "Under 5 hours" },
  { value: "5_15", label: "5 to 15 hours" },
  { value: "15_30", label: "15 to 30 hours" },
  { value: "full", label: "Full time on it" },
];

// The leading indicator for a pre-revenue company, and the one the old form
// never asked for. Revenue tells you what already happened; conversations
// tell you what is about to.
export const CONVERSATION_OPTIONS: QuestionOption[] = [
  { value: "0", label: "None" },
  { value: "1_2", label: "One or two" },
  { value: "3_5", label: "Three to five" },
  { value: "6_10", label: "Six to ten" },
  { value: "10_plus", label: "More than ten" },
];

export const RUNWAY_OPTIONS: QuestionOption[] = [
  { value: "not_spending", label: "I am not spending money on it yet" },
  { value: "under_3", label: "Under 3 months" },
  { value: "3_6", label: "3 to 6 months" },
  { value: "6_12", label: "6 to 12 months" },
  { value: "over_12", label: "More than a year" },
];

export const CONFIDENCE_OPTIONS: QuestionOption[] = Array.from({ length: 10 }, (_, i) => ({
  value: String(i + 1),
  label: String(i + 1),
}));

let seq = 0;
const w = (x: Omit<FormQuestion, "id" | "position">): FormQuestion => ({
  ...x, id: `fw-${x.key}`, position: (seq += 10),
});

export const DEFAULT_FOUNDER_WEEKLY_FORM: FormDefinition = {
  slug: "founder-weekly",
  name: "Founder weekly update",
  introTitle: "How did this week go?",
  introBody:
    "Eleven questions, and nine of them are one click. Last week's answers are already in the boxes, so change what moved and leave the rest. Your mentor reads this before your next meeting, and it is what the Launchpad team looks at when we decide who needs help.",
  introNote: "Takes about two minutes.",
  closingTitle: "Filed.",
  closingBody:
    "Your mentor can see it now. Come back any time this week to change an answer.",
  questions: [
    w({ key: "hours", section: "This week", type: "dropdown", required: true,
        label: "How much time did you put into it?",
        help: "Count the hours you actually worked on it. A light week is worth recording, and nobody is graded on this.",
        options: HOURS_OPTIONS }),
    w({ key: "conversations", section: "This week", type: "dropdown", required: true,
        label: "How many people outside your team did you talk to about it?",
        help: "Customers, users, anyone in the industry. People who could tell you that you are wrong.",
        options: CONVERSATION_OPTIONS }),
    w({ key: "shipped", section: "This week", type: "short_text", required: true,
        label: "What is the one thing you finished?",
        help: "One line. Something that exists now and did not exist last Monday. A week with nothing in it can say so." }),

    w({ key: "users_count", section: "The numbers", type: "number", required: false,
        label: "People using it right now",
        help: "Leave it empty if there is nothing to use yet. Count people who came back, rather than everyone who ever signed up." }),
    w({ key: "paying_count", section: "The numbers", type: "number", required: false,
        label: "Paying customers" }),
    w({ key: "revenue", section: "The numbers", type: "number", required: false,
        label: "Money you collected this week, in dollars",
        help: "What actually landed in the account between Monday and today. Zero is an answer, and it is the answer most weeks." }),
    w({ key: "runway", section: "The numbers", type: "dropdown", required: true,
        label: "How long can you keep going at what you are spending now?",
        help: "Your own runway counts. Most founders here are funding this out of savings or a salary.",
        options: RUNWAY_OPTIONS }),

    w({ key: "confidence", section: "Where you need help", type: "dropdown", required: true,
        label: "How confident are you this week that this is going to work?",
        help: "1 to 10. The same scale as your meeting note, so the two sit on one line over the twelve weeks.",
        options: CONFIDENCE_OPTIONS }),
    w({ key: "blocker", section: "Where you need help", type: "long_text", required: true,
        label: "What is in your way right now?",
        help: "One or two sentences. This is the question your mentor reads first, so write the real one." }),
    w({ key: "ask", section: "Where you need help", type: "short_text", required: false,
        label: "One thing Launchpad could do this week that would actually help",
        help: "Optional. An introduction, someone to talk to who has done this before, a customer, a room. We cannot promise it, but we cannot do it if we do not know." }),
    // The one place a founder can move their own match. Their ranking drives
    // matching, and until now it was frozen at whatever they said in week one.
    w({ key: "needs_changed", section: "Where you need help", type: "ranked_select", required: false,
        maxSelect: 3,
        label: "Has what you need help with changed?",
        help: "Optional, and most weeks it has not. Fill this in only if your top three have moved, and we will update what your mentor sees and what we match on.",
        options: SKILL_OPTIONS }),
  ],
};

// Everything the questions above have to say about how to read an answer,
// kept next to the questions so a label never drifts from a stored value.
export const WEEKLY_LABELS: Record<string, Record<string, string>> = {
  hours: Object.fromEntries(HOURS_OPTIONS.map((o) => [o.value, o.label])),
  conversations: Object.fromEntries(CONVERSATION_OPTIONS.map((o) => [o.value, o.label])),
  runway: Object.fromEntries(RUNWAY_OPTIONS.map((o) => [o.value, o.label])),
};

// Sort order for the answers that are bands rather than numbers, so a trend
// can say whether a week went up or down.
export const HOURS_RANK: Record<string, number> = {
  none: 0, under_5: 1, "5_15": 2, "15_30": 3, full: 4,
};
export const CONVERSATION_RANK: Record<string, number> = {
  "0": 0, "1_2": 1, "3_5": 2, "6_10": 3, "10_plus": 4,
};
export const RUNWAY_RANK: Record<string, number> = {
  under_3: 0, "3_6": 1, "6_12": 2, over_12: 3, not_spending: 4,
};
