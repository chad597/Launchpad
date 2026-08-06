// The mentor application form: types, and the default definition that ships
// with the app. The database is seeded from DEFAULT_MENTOR_FORM, and admins
// edit it from /admin/forms afterwards. Demo mode renders this constant
// directly, so the public form looks the same with or without a database.

export type QuestionType =
  | "short_text"
  | "long_text"
  | "email"
  | "phone"
  | "url"
  | "dropdown"
  | "multi_select"
  | "ranked_select"
  | "statement"
  | "consent";

export const QUESTION_TYPES: { value: QuestionType; label: string; note: string }[] = [
  { value: "short_text", label: "Short text", note: "One line" },
  { value: "long_text", label: "Long text", note: "A paragraph" },
  { value: "email", label: "Email", note: "Validated" },
  { value: "phone", label: "Phone", note: "One line" },
  { value: "url", label: "Link", note: "Validated" },
  { value: "dropdown", label: "Pick one", note: "Dropdown of options" },
  { value: "multi_select", label: "Pick several", note: "Checkboxes" },
  { value: "ranked_select", label: "Pick and rank", note: "Ordered, strongest first" },
  { value: "statement", label: "Statement", note: "Text only, nothing to answer" },
  { value: "consent", label: "Agreement", note: "A checkbox they must tick" },
];

export interface QuestionOption {
  value: string;
  label: string;
  description?: string;
}

export interface FormQuestion {
  id: string;
  key: string;            // stable identifier: answer key and column header
  section: string;
  position: number;
  type: QuestionType;
  label: string;
  help?: string;
  body?: string;          // statement copy
  options?: QuestionOption[];
  required: boolean;
  maxSelect?: number;     // multi_select and ranked_select
  archived?: boolean;
}

export interface FormDefinition {
  slug: string;
  name: string;
  introTitle: string;
  introBody: string;
  introNote?: string;
  closingTitle: string;
  closingBody: string;
  questions: FormQuestion[];
}

// Shared vocabulary. The founder questionnaire must use these exact strings
// for the match to join cleanly.
export const SKILL_OPTIONS: QuestionOption[] = [
  { value: "first_customers", label: "Finding first customers" },
  { value: "building_product", label: "Building the product" },
  { value: "pricing", label: "Pricing" },
  { value: "raising_money", label: "Raising money" },
  { value: "hiring", label: "Hiring and managing people" },
  { value: "business_setup", label: "Setting up the business (legal, finance, admin)" },
  { value: "selling_b2b", label: "Selling into companies" },
  { value: "marketing_growth", label: "Marketing and growth" },
  { value: "strategy", label: "Strategy and focus" },
  { value: "other", label: "Something else" },
];

export const TIME_ZONE_OPTIONS: QuestionOption[] = [
  { value: "eastern", label: "Eastern" },
  { value: "central", label: "Central" },
  { value: "mountain", label: "Mountain" },
  { value: "pacific", label: "Pacific" },
  { value: "other", label: "Other" },
];

export const INDUSTRY_OPTIONS: QuestionOption[] = [
  { value: "software", label: "Software" },
  { value: "hardware_iot", label: "Hardware and IoT" },
  { value: "ai_ml", label: "AI and ML" },
  { value: "fintech", label: "Fintech" },
  { value: "healthtech", label: "Healthtech" },
  { value: "edtech", label: "Edtech" },
  { value: "ecommerce", label: "E-commerce" },
  { value: "consumer", label: "Consumer" },
  { value: "b2b_services", label: "B2B services" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "sportstech", label: "Sportstech" },
  { value: "cybersecurity", label: "Cybersecurity" },
  { value: "other", label: "Other" },
];

const EXPECTATIONS = `Our founders are at the idea stage. Most of them are working on something you have already lived through.

**What we look for**

You have built or run something. That might be a company you founded, a business you owned, or a unit whose numbers you were responsible for. You have watched a plan not survive contact with real customers, and you can talk about that as easily as you talk about the wins. You give advice people can act on, grounded in what actually happened to you.

You do not need to have exited a company, raised venture money, or worked in tech. Some of our most useful mentors ran businesses that never took a dollar of outside investment.

**What we ask**

- Show up when you commit.
- Listen before you give advice.
- Be honest, including when the honest answer is that you do not know.
- Tell us early when something is not working. That is a favor to us, not a complaint.

**What this is not**

Mentoring is not a channel for selling services, sourcing deals, or recruiting. If you and a founder later decide you want to work together commercially, that conversation happens outside the program, and after it.`;

let seq = 0;
const q = (x: Omit<FormQuestion, "id" | "position">): FormQuestion => ({
  ...x, id: `q-${x.key}`, position: (seq += 10),
});

export const DEFAULT_MENTOR_FORM: FormDefinition = {
  slug: "mentor-application",
  name: "Mentor application",
  introTitle: "Mentor a Launchpad founder.",
  introBody:
    "Our founders are at the idea stage, working on something you have probably already lived through. Tell us what you have done and how you want to be involved, and we will handle the matching.",
  introNote: "Takes about 3 minutes.",
  closingTitle: "Thanks, that is everything we need.",
  closingBody:
    "Chad reads every one of these personally. You will hear from him within a week, either way. If it is a fit, the next step is a short profile so we can match you well.\n\nIn the meantime we will send you an invite to the Launchpad community, where you can see what our founders are working on and answer a question whenever you have a few minutes.",
  questions: [
    q({ key: "first_name", section: "About you", type: "short_text", label: "First name", required: true }),
    q({ key: "last_name", section: "About you", type: "short_text", label: "Last name", required: true }),
    q({ key: "email", section: "About you", type: "email", label: "Email", required: true,
        help: "This is the address you will sign in with, so use the one you check." }),
    q({ key: "phone", section: "About you", type: "phone", label: "Phone", required: true }),
    q({ key: "company", section: "About you", type: "short_text", label: "Company", required: false }),
    q({ key: "title", section: "About you", type: "short_text", label: "Title", required: false }),
    q({ key: "linkedin", section: "About you", type: "url", label: "LinkedIn URL", required: true }),
    q({ key: "time_zone", section: "About you", type: "dropdown", label: "Time zone", required: true,
        options: TIME_ZONE_OPTIONS }),
    q({ key: "years_experience", section: "About you", type: "dropdown", required: true,
        label: "How long have you been working in technology or startups?",
        options: [
          { value: "under_5", label: "Under 5 years" }, { value: "5_10", label: "5 to 10 years" },
          { value: "10_20", label: "10 to 20 years" }, { value: "20_plus", label: "20+ years" },
        ] }),

    q({ key: "expectations", section: "What we look for", type: "statement", required: false,
        label: "What we look for, and what we ask", body: EXPECTATIONS }),

    q({ key: "background", section: "Your experience", type: "multi_select", required: true,
        label: "Which of these describe you?", help: "Select all that apply.",
        options: [
          { value: "founded", label: "Founded or co-founded a company" },
          { value: "exited", label: "Exited a company through a sale, acquisition, or IPO" },
          { value: "pnl", label: "Ran a P&L or a business unit" },
          { value: "operator", label: "Early employee or senior operator at a startup" },
          { value: "sme", label: "Deep expertise in one area, without founding a company" },
        ] }),
    q({ key: "industries", section: "Your experience", type: "multi_select", required: true,
        label: "Where have you actually operated?", help: "Select all that apply.",
        options: INDUSTRY_OPTIONS }),
    q({ key: "skills", section: "Your experience", type: "ranked_select", required: true, maxSelect: 3,
        label: "What can you help a founder do?",
        help: "Choose up to three, strongest first. We weight your first answer most heavily when matching.",
        options: SKILL_OPTIONS }),
    q({ key: "story", section: "Your experience", type: "long_text", required: true,
        label: "Tell us about a problem you have solved that a first-time founder is likely to hit.",
        help: "Two or three sentences. Specific beats impressive. Your founder will read this when we introduce you." }),

    q({ key: "tracks", section: "How you want to be involved", type: "multi_select", required: true,
        label: "How do you want to be involved?", help: "Select all that apply.",
        options: [
          { value: "ask_a_mentor", label: "Answer questions online",
            description: "Founders post questions by topic and you jump in when something is in your lane. No schedule, no commitment." },
          { value: "office_hours", label: "Hold office hours",
            description: "You open a two-hour window and founders book 30-minute slots. Usually once or twice a cohort." },
          { value: "one_to_one", label: "Take on one founder for 12 weeks",
            description: "A working relationship with a single founder, roughly 30 to 60 minutes every couple of weeks. This is the deep end." },
        ] }),

    q({ key: "ground_rules", section: "Ground rules", type: "consent", required: true,
        label: "Understood, I am in",
        body: "Two things we ask of everyone. You are volunteering your experience, not selling your services. And what a founder tells you stays with you.\n\nThese are the short version of our Mentor Code of Conduct." }),
    q({ key: "referral", section: "Ground rules", type: "short_text", required: false,
        label: "How did you hear about Launchpad?" }),
  ],
};

let seqB = 0;
const p = (x: Omit<FormQuestion, "id" | "position">): FormQuestion => ({
  ...x, id: `p-${x.key}`, position: (seqB += 10),
});

// Form B: completed by an accepted mentor at first sign-in.
export const DEFAULT_PROFILE_FORM: FormDefinition = {
  slug: "mentor-profile",
  name: "Mentor profile",
  introTitle: "You are in. Let's set up your profile.",
  introBody:
    "This is what founders see when we introduce you, and it is what we use to make the match. Three minutes, and you can change any of it later.",
  closingTitle: "Your profile is set.",
  closingBody:
    "We will be in touch when we have a founder who fits. In the meantime your profile is live and you can update it any time from your dashboard.",
  questions: [
    p({ key: "bio", section: "Your profile", type: "short_text", required: true,
        label: "How would you describe yourself to a founder, in one line?",
        help: 'For example: "Co-founder and CEO at Northwind, previously ran ops at a payments company."' }),
    p({ key: "avoid_skills", section: "Fit", type: "multi_select", required: false,
        label: "Anything you would rather not be the go-to for?",
        help: "Select any. We ask because a founder's biggest problem should not land with someone who is lukewarm about it. This has no bearing on your place in the program, and you can change it any time.",
        options: SKILL_OPTIONS }),
    p({ key: "mentoring_format", section: "Fit", type: "dropdown", required: true,
        label: "Preferred mentoring format",
        options: [
          { value: "hands_on", label: "Hands-on", description: "I like to get into the work with them." },
          { value: "advisory", label: "Advisory", description: "They bring what they are wrestling with and I pressure-test it." },
          { value: "coaching", label: "Coaching", description: "I mostly ask questions and let them find the answer." },
          { value: "structured", label: "Structured", description: "I like clear goals and checking progress against them." },
          { value: "depends", label: "Depends on the founder" },
        ] }),
    p({ key: "stage_preference", section: "Fit", type: "dropdown", required: true,
        label: "Our founders are mostly pre-product or pre-revenue. Where are you most useful?",
        options: [
          { value: "idea", label: "Idea and pre-product" },
          { value: "first_customers", label: "Just got their first customers" },
          { value: "both", label: "Both" },
          { value: "no_preference", label: "No preference" },
        ] }),
    p({ key: "capacity", section: "Commitment", type: "dropdown", required: false,
        label: "How many founders can you take at once?",
        help: "Only relevant if you are taking on a founder for 12 weeks. You can set this to zero later to pause without leaving the pool.",
        options: [
          { value: "1", label: "One" }, { value: "2", label: "Two" }, { value: "3", label: "Three or more" },
        ] }),
    p({ key: "availability", section: "Commitment", type: "short_text", required: true,
        label: "When are you usually free?",
        help: 'Rough is fine. For example: "Tuesday and Thursday afternoons."' }),
    p({ key: "conflicts", section: "Commitment", type: "long_text", required: false,
        label: "Anything we should know before we match you?",
        help: "A competing business, an investment interest, or an existing relationship with someone in the program. Optional, and disclosing something rarely changes anything. It just lets us make the call together." }),
    p({ key: "mentor_motivation", section: "Commitment", type: "long_text", required: false,
        label: "What would make this worth your time?",
        help: "Optional. Staying close to early-stage work, meeting other operators, something else entirely." }),
  ],
};

export function slugifyKey(label: string, taken: string[]): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 40) || "question";
  if (!taken.includes(base)) return base;
  let n = 2;
  while (taken.includes(`${base}_${n}`)) n++;
  return `${base}_${n}`;
}

// Renders a stored answer as a single readable cell for tables and CSV.
export function answerToText(qn: FormQuestion, value: unknown): string {
  if (value == null || value === "") return "";
  const labelFor = (v: string) => qn.options?.find((o) => o.value === v)?.label ?? v;
  if (Array.isArray(value)) {
    return qn.type === "ranked_select"
      ? value.map((v, i) => `${i + 1}. ${labelFor(String(v))}`).join(" · ")
      : value.map((v) => labelFor(String(v))).join(", ");
  }
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return qn.type === "dropdown" ? labelFor(String(value)) : String(value);
}
