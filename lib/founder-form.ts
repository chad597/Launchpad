// The founder side of matching, in two forms.
//
//   founder-intake  Every founder fills this in at first sign-in. It is what
//                   the match is made from, so the answers matching reads are
//                   options rather than free text, and they reuse the mentor
//                   form's exact values so the two sides join.
//   founder-brief   Filled in once a pairing exists, before the first meeting.
//                   It is written to the mentor rather than to the program,
//                   and it goes stale within weeks, which is why it is not
//                   asked at intake.
//
// Everything a founder writes in either form is visible to their matched
// mentor. Anything meant for staff alone goes through /flag instead, and the
// last question on the intake form says so.
import {
  INDUSTRY_OPTIONS, SKILL_OPTIONS, TIME_ZONE_OPTIONS,
  type FormDefinition, type FormQuestion, type QuestionOption,
} from "./mentor-form";

// Where a founder is today. The first two values are what a mentor who picked
// 'idea' wants, the last two are what a mentor who picked 'first_customers'
// wants, which is how the two forms line up.
export const FOUNDER_STAGE_OPTIONS: QuestionOption[] = [
  { value: "idea", label: "An idea, nothing built yet" },
  { value: "building", label: "Building it, not launched" },
  { value: "first_customers", label: "Launched, working on first customers" },
  { value: "revenue", label: "Paying customers, working on growth" },
];

// Values must stay identical to the mentor profile's mentoring_format
// question. Only the labels differ, because each side is describing the same
// arrangement from their own chair.
export const FOUNDER_FORMAT_OPTIONS: QuestionOption[] = [
  { value: "hands_on", label: "Hands-on", description: "Get into the work with me." },
  { value: "advisory", label: "Advisory", description: "I bring what I am wrestling with and you pressure-test it." },
  { value: "coaching", label: "Coaching", description: "Ask me questions and let me find the answer." },
  { value: "structured", label: "Structured", description: "Set goals with me and hold me to them." },
  { value: "depends", label: "I am not sure yet" },
];

export const TEAM_OPTIONS: QuestionOption[] = [
  { value: "solo", label: "Just me" },
  { value: "cofounders", label: "Me and a co-founder or two" },
  { value: "team", label: "We have people on payroll" },
];

export const COMMITMENT_OPTIONS: QuestionOption[] = [
  { value: "full_time", label: "Full time" },
  { value: "part_time", label: "Part time, alongside a job" },
  { value: "nights", label: "Evenings and weekends" },
];

// How hard to weight industry overlap for this founder.
export const INDUSTRY_PREF_OPTIONS: QuestionOption[] = [
  { value: "a_lot", label: "A lot, I want someone from my world" },
  { value: "somewhat", label: "Somewhat" },
  { value: "not_much", label: "Not much, the problem matters more than the industry" },
];

export const CANDOR_OPTIONS: QuestionOption[] = [
  { value: "direct", label: "Tell me straight" },
  { value: "questions", label: "Ask me questions and let me get there myself" },
  { value: "gentle", label: "Ease into it, then get specific" },
];

const GROUND_RULES = `Three things we ask. Show up for the meetings you book. Fill in your half of the meeting note the day before, so your mentor walks in ready. Tell us early when something is not working, including when the match is wrong.

Your mentor is volunteering their time. Treating it as valuable is the whole deal.`;

let seqI = 0;
const i = (x: Omit<FormQuestion, "id" | "position">): FormQuestion => ({
  ...x, id: `fi-${x.key}`, position: (seqI += 10),
});

export const DEFAULT_FOUNDER_INTAKE_FORM: FormDefinition = {
  slug: "founder-intake",
  name: "Founder intake",
  introTitle: "Welcome to Launchpad mentorship.",
  introBody:
    "We match you with a mentor who has already solved the problem in front of you. Tell us what you are building and where you need help, and we will handle the rest. Your mentor reads your answers when we introduce you.",
  introNote: "Takes about five minutes.",
  closingTitle: "That is everything we need.",
  closingBody:
    "Chad matches every founder by hand, and you meet your mentor in week 3. You can change any of these answers from your home screen.",
  questions: [
    i({ key: "phone", section: "About you", type: "phone", required: true, label: "Phone",
        help: "Your mentor gets this when we introduce you, so use the number you answer." }),
    i({ key: "company", section: "About you", type: "short_text", required: true,
        label: "What is your company or project called?", help: "A working name is fine." }),
    i({ key: "website", section: "About you", type: "url", required: false,
        label: "Website or link",
        help: "A site, a landing page, a demo. Leave it empty if there is nothing to show yet." }),
    i({ key: "linkedin", section: "About you", type: "url", required: false, label: "LinkedIn URL" }),
    i({ key: "time_zone", section: "About you", type: "dropdown", required: true,
        label: "Time zone", options: TIME_ZONE_OPTIONS }),
    i({ key: "availability", section: "About you", type: "short_text", required: true,
        label: "When are you usually free to meet?",
        help: 'Rough is fine. For example: "Tuesday and Thursday afternoons." We show it to your mentor when either of you books a meeting.' }),

    i({ key: "one_liner", section: "What you are building", type: "short_text", required: true,
        label: "What are you building, in one sentence?",
        help: "Plain language beats a pitch. Your mentor sees this first." }),
    i({ key: "industry", section: "What you are building", type: "dropdown", required: true,
        label: "Which of these is closest to what you are building?",
        help: "Pick the nearest one. We use it to find mentors who have operated in the same world.",
        options: INDUSTRY_OPTIONS }),
    i({ key: "stage", section: "What you are building", type: "dropdown", required: true,
        label: "Where are you today?", options: FOUNDER_STAGE_OPTIONS }),
    i({ key: "team", section: "What you are building", type: "dropdown", required: true,
        label: "Who is working on it?", options: TEAM_OPTIONS }),
    i({ key: "commitment", section: "What you are building", type: "dropdown", required: true,
        label: "How much time do you give it?", options: COMMITMENT_OPTIONS }),

    i({ key: "needs", section: "What you need", type: "ranked_select", required: true, maxSelect: 3,
        label: "What do you most need help with?",
        help: "Choose up to three, most pressing first. We weight your first answer most heavily, and we will not match you with a mentor who is lukewarm about it.",
        options: SKILL_OPTIONS }),
    // The old Typeform asked founders to name their own role and strengths in
    // free text, which nothing could match on. Asked against the same list as
    // needs, it earns its place: a mentor whose strongest skill is the one the
    // founder already has covered is a weaker match than the score suggests.
    i({ key: "strengths", section: "What you need", type: "multi_select", required: false,
        label: "What do you already have covered?",
        help: "Optional. Select anything you are genuinely strong at, so we do not spend your match on it.",
        options: SKILL_OPTIONS }),
    i({ key: "biggest_challenge", section: "What you need", type: "long_text", required: true,
        label: "What is the hardest thing in front of you right now?",
        help: "Two or three sentences. The more specific you are, the better we can match you." }),
    i({ key: "win", section: "What you need", type: "long_text", required: true,
        label: "Twelve weeks from now, what would make this worth your time?",
        help: "One or two things you want to be true that are not true today." }),

    i({ key: "mentoring_format", section: "How you like to work", type: "dropdown", required: true,
        label: "How do you want your mentor to work with you?",
        options: FOUNDER_FORMAT_OPTIONS }),
    i({ key: "industry_pref", section: "How you like to work", type: "dropdown", required: true,
        label: "How much does it matter that your mentor has worked in your industry?",
        options: INDUSTRY_PREF_OPTIONS }),

    i({ key: "ground_rules", section: "Before we match you", type: "consent", required: true,
        label: "Understood, I am in", body: GROUND_RULES }),
    i({ key: "anything_else", section: "Before we match you", type: "long_text", required: false,
        label: "Anything else your mentor should know before you meet?",
        help: "Optional. Your mentor reads your answers, so if something is only for the Launchpad team, use the flag link on your home screen instead." }),
  ],
};

let seqB = 0;
const b = (x: Omit<FormQuestion, "id" | "position">): FormQuestion => ({
  ...x, id: `fb-${x.key}`, position: (seqB += 10),
});

export const DEFAULT_FOUNDER_BRIEF_FORM: FormDefinition = {
  slug: "founder-brief",
  name: "Founder brief",
  introTitle: "Brief your mentor.",
  introBody:
    "Your mentor reads this before your first meeting, so the time goes to the conversation instead of a recap. Write it the way you would explain it to someone who knows the industry. Ten minutes here buys back the first half of your first meeting.",
  introNote: "Takes about ten minutes.",
  closingTitle: "Sent.",
  closingBody: "Your mentor can read it now. You can update it any time from your home screen.",
  questions: [
    b({ key: "traction", section: "Where things stand", type: "long_text", required: true,
        label: "Where does it stand today?",
        help: "Customers, users, revenue, a prototype, or an idea on paper. Real numbers if you have them, and say so plainly if you do not." }),
    b({ key: "recent_progress", section: "Where things stand", type: "long_text", required: false,
        label: "What have you gotten done in the last three months?",
        help: "Optional. It tells your mentor how fast you move." }),
    b({ key: "tried", section: "Where things stand", type: "long_text", required: true,
        label: "What have you already tried on the problem you want help with?",
        help: "It saves your mentor from suggesting the thing you ruled out months ago." }),

    b({ key: "stuck", section: "What you want from this", type: "long_text", required: true,
        label: "What are you stuck on right now?" }),
    b({ key: "decision", section: "What you want from this", type: "long_text", required: false,
        label: "Is there a decision you are sitting on?",
        help: "Optional. Something you keep turning over and have not called yet." }),
    b({ key: "first_meeting", section: "What you want from this", type: "long_text", required: true,
        label: "What do you want to walk out of the first meeting with?" }),

    b({ key: "candor", section: "How to be useful to you", type: "dropdown", required: true,
        label: "How do you like to be coached?",
        options: CANDOR_OPTIONS }),
    b({ key: "context", section: "How to be useful to you", type: "long_text", required: false,
        label: "Anything about you or your situation that helps them understand you?",
        help: "Optional. A job you are leaving, a co-founder conversation you are dreading, a deadline nobody else knows about." }),
    b({ key: "links", section: "How to be useful to you", type: "long_text", required: false,
        label: "Anything you want them to look at before you meet?",
        help: "Optional. Paste links. A deck, a demo, a doc, a competitor you keep losing to." }),
  ],
};

// The one-line summary that mentor and admin lists show under a founder's
// name. Built from the two answers that are always there.
export function founderStageLine(stage?: string, industry?: string): string {
  const stageLabel = FOUNDER_STAGE_OPTIONS.find((o) => o.value === stage)?.label;
  const industryLabel = INDUSTRY_OPTIONS.find((o) => o.value === industry)?.label;
  return [stageLabel, industryLabel].filter(Boolean).join(" · ");
}
