// Demo-mode seed data. Mirrors supabase/seed.sql so the app behaves the same
// before and after the real database exists. The Rivera/Patel meeting content
// comes from the worked example in the Launchpad meeting-note guides.
import type {
  ActionItem, Cohort, Flag, MatchSuggestion, Meeting, MeetingNote, Message, Pairing, User,
} from "./types";

// Week 4 of Cohort 7 anchors "today" for the demo so dates stay coherent.
export const DEMO_TODAY = "2026-08-03T12:00:00.000Z";

// Everyone carries the intake answers matching reads, because the match
// report is only worth looking at when both sides have answered. Nia is the
// exception on purpose: no answers and no mentor, which is what every founder
// looks like in week 1 and what the report has to handle without pretending
// silence is a bad score.
export const users: User[] = [
  { id: "u-chad", email: "chad@launchpad.test", name: "Chad Hensel", role: "admin" },
  {
    id: "u-alex", email: "alex@trellis.test", name: "Alex Rivera", role: "founder",
    company: "Trellis", stage: "Building it, not launched · Consumer",
    bio: "A booking marketplace that fills the empty hours at neighborhood gyms.",
    website: "https://trellis.test", linkedin: "https://linkedin.com/in/alexrivera",
    phone: "864-555-0148", timeZone: "eastern", availability: "Weekday mornings, and most of Thursday",
    industries: ["consumer"], founderStage: "building", teamShape: "cofounders",
    timeCommitment: "full_time", needs: ["first_customers", "pricing", "strategy"],
    strengths: ["building_product"], mentoringFormat: "advisory", industryPref: "not_much",
    challenge: "We have twelve gyms signed up and almost no bookings. I cannot tell whether the problem is that the gyms are wrong, the price is wrong, or that nobody knows we exist.",
    goal: "A repeatable way to get bookings that does not depend on me texting people, and enough revenue to prove it works.",
  },
  {
    id: "u-jordan", email: "jordan@fernway.test", name: "Jordan Lee", role: "founder",
    company: "Fernway", stage: "An idea, nothing built yet · Consumer",
    bio: "A journaling app that turns a week of notes into one page you would actually reread.",
    timeZone: "eastern", availability: "Most afternoons",
    industries: ["consumer"], founderStage: "idea", teamShape: "solo", timeCommitment: "nights",
    needs: ["building_product", "first_customers"], mentoringFormat: "coaching",
    industryPref: "somewhat",
    challenge: "I keep building and I have not shown it to anyone outside my group chat.",
    goal: "Fifty people using it who I have never met.",
  },
  {
    id: "u-priya", email: "priya@lucent.test", name: "Priya Nguyen", role: "founder",
    company: "Lucent Pay", stage: "Launched, working on first customers · Fintech",
    bio: "Reconciliation for small firms that still close their books in a spreadsheet.",
    timeZone: "eastern", availability: "Tuesday and Wednesday mornings",
    industries: ["fintech"], founderStage: "first_customers", teamShape: "cofounders",
    timeCommitment: "full_time", needs: ["pricing", "selling_b2b", "raising_money"],
    strengths: ["building_product"], mentoringFormat: "structured", industryPref: "a_lot",
    challenge: "Three firms are using it and none of them are paying what it costs to serve them.",
    goal: "A price I can say out loud without flinching, and five firms paying it.",
  },
  {
    id: "u-marcusb", email: "marcus@okafor.test", name: "Ade Okafor", role: "founder",
    company: "Plotline", stage: "An idea, nothing built yet · Consumer",
    bio: "Story planning tools for people who write serialized fiction online.",
    timeZone: "eastern", availability: "Evenings",
    industries: ["consumer"], founderStage: "idea", teamShape: "solo", timeCommitment: "part_time",
    needs: ["building_product", "strategy", "first_customers"], mentoringFormat: "coaching",
    industryPref: "not_much",
    challenge: "I have three versions of what this could be and no way to choose between them.",
    goal: "One version, built enough that writers can tell me it is wrong.",
  },
  {
    id: "u-rosa", email: "rosa@marsh.test", name: "Rosa Marsh", role: "founder",
    company: "Kindling", stage: "Launched, working on first customers · B2B services",
    bio: "Fractional operations help for family-owned manufacturers.",
    timeZone: "eastern", availability: "Monday and Friday, any time",
    industries: ["b2b_services"], founderStage: "first_customers", teamShape: "solo",
    timeCommitment: "full_time", needs: ["pricing", "selling_b2b", "hiring"],
    mentoringFormat: "structured", industryPref: "a_lot",
    challenge: "I am the product, and I am booked. Raising the price is the only lever I have not pulled.",
    goal: "Two people delivering the work instead of me.",
  },
  { id: "u-nia", email: "nia@sagepath.test", name: "Nia Chambers", role: "founder", company: "Sagepath" },
  {
    id: "u-sam", email: "sam@mentor.test", name: "Sam Patel", role: "mentor",
    bio: "Founder, 2 exits", expertise: ["Marketplaces", "Customer discovery", "Early GTM"],
    title: "Co-founder", company: "Northwind (sold 2021)",
    timeZone: "eastern", availability: "Thursdays, open to more", capacity: 2,
    yearsExperience: "20_plus", background: ["founded", "exited"],
    industries: ["consumer", "ecommerce"], skills: ["first_customers", "strategy", "pricing"],
    avoidSkills: ["raising_money"], stagePreference: "idea", mentoringFormat: "advisory",
    story: "I spent nine months building a supply side nobody wanted before I called a single buyer. The second company started with forty conversations and no code.",
  },
  {
    id: "u-brooks", email: "brooks@mentor.test", name: "Casey Brooks", role: "mentor",
    bio: "SaaS operator", expertise: ["B2B sales", "Hiring"],
    title: "VP Sales", company: "Rivermark",
    timeZone: "central", availability: "Wednesday afternoons", capacity: 1,
    yearsExperience: "10_20", background: ["operator", "pnl"],
    industries: ["software", "b2b_services"], skills: ["selling_b2b", "hiring"],
    // The reason this pair reads badly in the report as well as on the health
    // board: Priya's first need is the one thing Casey asked not to own.
    avoidSkills: ["pricing"], stagePreference: "first_customers", mentoringFormat: "hands_on",
    story: "I built the first sales team at a company that had been selling on the founder's charm for two years.",
  },
  {
    id: "u-grant", email: "grant@mentor.test", name: "R. Grant", role: "mentor",
    bio: "3x founder", expertise: ["Validation", "Product"],
    title: "Founder", company: "Ostrich Labs",
    timeZone: "eastern", availability: "Tuesday mornings", capacity: 2,
    yearsExperience: "20_plus", background: ["founded", "sme"],
    industries: ["software", "consumer"], skills: ["building_product", "strategy", "first_customers"],
    avoidSkills: [], stagePreference: "idea", mentoringFormat: "coaching",
    story: "Three products, two of which should have been killed six months before I killed them.",
  },
  {
    id: "u-deluca", email: "deluca@mentor.test", name: "Mia DeLuca", role: "mentor",
    bio: "Services founder, 1 exit", expertise: ["B2B services", "Pricing"],
    title: "Founder", company: "Vantage Ops (sold 2023)",
    timeZone: "eastern", availability: "Mondays and Friday mornings", capacity: 1,
    yearsExperience: "10_20", background: ["founded", "exited", "pnl"],
    industries: ["b2b_services", "manufacturing"], skills: ["pricing", "selling_b2b", "hiring"],
    avoidSkills: ["raising_money"], stagePreference: "first_customers", mentoringFormat: "structured",
    story: "I tripled my rate in one year and lost two clients doing it. Both of them came back.",
  },
  {
    id: "u-dana", email: "dana@mentor.test", name: "Dana Whitfield", role: "mentor",
    bio: "FinTech founder, 1 exit", expertise: ["FinTech", "Pricing", "Fundraising"],
    title: "Founder", company: "Ledgerline",
    timeZone: "eastern", availability: "Wednesday and Thursday mornings", capacity: 1,
    yearsExperience: "20_plus", background: ["founded", "exited"],
    industries: ["fintech", "software"], skills: ["pricing", "selling_b2b", "raising_money"],
    avoidSkills: [], stagePreference: "first_customers", mentoringFormat: "structured",
    story: "We repriced three times in eighteen months. The third one was the one that worked, and it was the one that scared us.",
  },
  {
    id: "u-hale", email: "hale@mentor.test", name: "Marcus Hale", role: "mentor",
    bio: "Payments PM, 12 yrs", expertise: ["Payments", "Partnerships"],
    title: "Director of Product", company: "Cardinal",
    timeZone: "pacific", availability: "Friday mornings", capacity: 1,
    yearsExperience: "10_20", background: ["operator", "sme"],
    industries: ["fintech"], skills: ["building_product", "selling_b2b"],
    avoidSkills: ["hiring"], stagePreference: "no_preference", mentoringFormat: "advisory",
    story: "Twelve years of shipping payments products inside companies big enough to survive my mistakes.",
  },
  {
    id: "u-cruz", email: "cruz@mentor.test", name: "Elena Cruz", role: "mentor",
    bio: "B2B SaaS founder", expertise: ["Sales", "SaaS"],
    title: "Co-founder", company: "Tallgrass",
    timeZone: "eastern", availability: "Most mornings", capacity: 1,
    yearsExperience: "5_10", background: ["founded"],
    industries: ["software", "b2b_services"], skills: ["selling_b2b", "first_customers", "pricing"],
    avoidSkills: [], stagePreference: "both", mentoringFormat: "hands_on",
    story: "I sold the first hundred accounts myself, badly, and then wrote down what worked.",
  },
];

export const cohorts: Cohort[] = [
  { id: "c-gvl7", ecosystem: "Greenville", name: "Cohort 7", startDate: "2026-07-06", status: "active" },
];

export const pairings: Pairing[] = [
  {
    id: "p-rivera", cohortId: "c-gvl7", founderId: "u-alex", mentorId: "u-sam",
    status: "active", declaredCadence: "biweekly",
    matchRationale: "Sam built and sold two marketplace companies and has coached founders through the exact two-sided discovery problem Trellis is working on now.",
    createdAt: "2026-07-17T14:00:00.000Z",
  },
  {
    id: "p-lee", cohortId: "c-gvl7", founderId: "u-jordan", mentorId: "u-sam",
    status: "active", declaredCadence: "weekly",
    matchRationale: "Sam's consumer-adjacent marketplace experience matches Fernway's early validation questions.",
    createdAt: "2026-07-17T14:00:00.000Z",
  },
  {
    id: "p-nguyen", cohortId: "c-gvl7", founderId: "u-priya", mentorId: "u-brooks",
    status: "active", declaredCadence: "biweekly",
    matchRationale: "Casey's B2B sales background matched Priya's go-to-market questions.",
    createdAt: "2026-07-17T14:00:00.000Z",
  },
  {
    id: "p-okafor", cohortId: "c-gvl7", founderId: "u-marcusb", mentorId: "u-grant",
    status: "active", declaredCadence: "biweekly",
    matchRationale: "Grant has taken three products through early validation.",
    createdAt: "2026-07-17T14:00:00.000Z",
  },
  {
    id: "p-marsh", cohortId: "c-gvl7", founderId: "u-rosa", mentorId: "u-deluca",
    status: "active", declaredCadence: "weekly",
    matchRationale: "Mia built and sold a services company one stage ahead of Kindling.",
    createdAt: "2026-07-17T14:00:00.000Z",
  },
];

export const meetings: Meeting[] = [
  // Rivera x Patel: week 2 done, week 4 upcoming (Thu Aug 6)
  { id: "m-rivera-1", pairingId: "p-rivera", scheduledAt: "2026-07-22T18:00:00.000Z", status: "completed", weekNumber: 2 },
  { id: "m-rivera-2", pairingId: "p-rivera", scheduledAt: "2026-08-06T18:00:00.000Z", status: "scheduled", weekNumber: 4 },
  // Lee x Patel: met Jul 31, mentor half overdue; next Fri Aug 7
  { id: "m-lee-1", pairingId: "p-lee", scheduledAt: "2026-07-31T15:00:00.000Z", status: "completed", weekNumber: 3 },
  { id: "m-lee-2", pairingId: "p-lee", scheduledAt: "2026-08-07T15:00:00.000Z", status: "scheduled", weekNumber: 4 },
  // Nguyen x Brooks: met once week 2, nothing since (red pair)
  { id: "m-nguyen-1", pairingId: "p-nguyen", scheduledAt: "2026-07-18T16:00:00.000Z", status: "completed", weekNumber: 2 },
  // Okafor x Grant: met 9 days ago, nothing booked (yellow)
  { id: "m-okafor-1", pairingId: "p-okafor", scheduledAt: "2026-07-25T14:00:00.000Z", status: "completed", weekNumber: 3 },
  // Marsh x DeLuca: healthy weekly pair
  { id: "m-marsh-1", pairingId: "p-marsh", scheduledAt: "2026-07-29T17:00:00.000Z", status: "completed", weekNumber: 3 },
  { id: "m-marsh-2", pairingId: "p-marsh", scheduledAt: "2026-08-12T17:00:00.000Z", status: "scheduled", weekNumber: 6 },
];

export const meetingNotes: MeetingNote[] = [
  {
    id: "n-rivera-1", meetingId: "m-rivera-1", statusFlag: "on_track", confidence: 7,
    founderSection: {
      actionItemCheckIds: [],
      whatMoved: ["Mapped the supply side of the market", "Set up first five field conversations"],
      whatChangedMyThinking: "Realized the supplier list is easier to build than expected; the buyer side is the open question.",
      whereINeedHelp: "How to structure early discovery interviews.",
      focusNextWeek: ["Talk to at least 5 people in the field", "Write down the passive-side value prop"],
    },
    mentorSection: {
      read: "Solid start. Confidence 7 seems fair.",
      whatImSeeing: ["Alex moves fast once a question is concrete"],
      risks: ["Interview quality over quantity"],
      focusAdjustments: ["Agreed plan as drafted"],
      myTake: "Good first working session. The next two weeks of interviews will tell us a lot.",
    },
    keyInsight: "Supply is not the constraint for Trellis.",
    decisionMade: null,
    founderSubmittedAt: "2026-07-21T14:00:00.000Z",
    mentorSubmittedAt: "2026-07-22T20:15:00.000Z",
  },
  {
    // Week 4 note: founder half submitted, mentor half pending (meeting upcoming)
    id: "n-rivera-2", meetingId: "m-rivera-2", statusFlag: "on_track", confidence: 6,
    founderSection: {
      actionItemCheckIds: ["a-rivera-1", "a-rivera-2"],
      whatMoved: [
        "Talked to about 7 people in the field, mostly informal",
        "Learned that roughly half of target users aren't active on the channel we assumed",
        "Started shaping a clearer value prop for the passive side of the market",
      ],
      whatChangedMyThinking: "I assumed our problem was reaching suppliers. The interviews showed supply is fine; the real question is why a passive buyer would ever show up.",
      whereINeedHelp: "I'm stuck on why someone would engage if they're not actively looking. Need help pressure-testing the value prop for that group.",
      focusNextWeek: ["Get a rough wireframe together", "Run a tighter set of interviews focused on behavior, not just opinions"],
    },
    mentorSection: null,
    keyInsight: null, decisionMade: null,
    founderSubmittedAt: "2026-08-03T17:14:00.000Z",
    mentorSubmittedAt: null,
  },
  {
    // Lee week 3: founder half in, mentor half overdue 3 days
    id: "n-lee-1", meetingId: "m-lee-1", statusFlag: "at_risk", confidence: 4,
    founderSection: {
      actionItemCheckIds: [],
      whatMoved: ["Sketched onboarding flow", "One user conversation"],
      whatChangedMyThinking: "Not sure this week. Mostly heads-down building.",
      whereINeedHelp: "Am I building too early?",
      focusNextWeek: ["Decide whether to pause the build"],
    },
    mentorSection: null,
    keyInsight: null, decisionMade: null,
    founderSubmittedAt: "2026-07-30T13:00:00.000Z",
    mentorSubmittedAt: null,
  },
];

export const actionItems: ActionItem[] = [
  { id: "a-rivera-1", meetingId: "m-rivera-1", pairingId: "p-rivera", description: "Talk to at least 5 people in the field", ownerId: "u-alex", dueDate: "2026-08-04", status: "done" },
  { id: "a-rivera-2", meetingId: "m-rivera-1", pairingId: "p-rivera", description: "Write down the passive-side value prop", ownerId: "u-alex", dueDate: "2026-08-04", status: "done" },
  { id: "a-lee-1", meetingId: "m-lee-1", pairingId: "p-lee", description: "List the riskiest assumption before building further", ownerId: "u-jordan", dueDate: "2026-08-05", status: "open" },
];

export const messages: Message[] = [
  { id: "msg-1", pairingId: "p-rivera", senderId: "u-alex", body: "Quick heads up, my note is in. The channel finding surprised me.", createdAt: "2026-08-02T19:40:00.000Z" },
  { id: "msg-2", pairingId: "p-rivera", senderId: "u-sam", body: "The wireframe direction makes sense. Bring whatever you have Thursday, rough is fine.", createdAt: "2026-08-02T20:12:00.000Z" },
  { id: "msg-3", pairingId: "p-rivera", senderId: "u-alex", body: "Will do. Also got two more interviews booked for Wednesday.", createdAt: "2026-08-02T21:03:00.000Z" },
];

export const flags: Flag[] = [
  {
    id: "f-1", raisedById: "u-grant", pairingId: null, category: "pattern_risk",
    body: "Third founder this cohort building before validating. Might be worth a workshop in week 5.",
    status: "open", createdAt: "2026-08-01T15:00:00.000Z",
  },
];

// Rematch shortlist for the red pair's founder (Priya Nguyen).
export const matchSuggestions: MatchSuggestion[] = [
  {
    id: "s-1", founderId: "u-priya", mentorId: "u-dana", score: 87,
    breakdown: ["Industry ✓ fintech", "Stage ✓ pre-revenue", "Asked for: pricing"],
    rationale: "Dana priced and repriced a B2B fintech product through the exact stage Priya is stuck on, and her questionnaire asks for direct, structured feedback, which matches Dana's style.",
    status: "suggested",
  },
  {
    id: "s-2", founderId: "u-priya", mentorId: "u-hale", score: 74,
    breakdown: ["Industry ✓ payments", "Skill: partnerships"],
    rationale: "Strong domain overlap; less experience with pre-revenue founders.",
    status: "suggested",
  },
  {
    id: "s-3", founderId: "u-priya", mentorId: "u-cruz", score: 68,
    breakdown: ["Stage ✓", "Skill: sales", "At capacity next month"],
    rationale: "Good stage fit; capacity is the concern.",
    status: "suggested",
  },
];

// Weekly updates. Alex has filed every week and this week is still open,
// which is the state the nudge is written for. Jordan filed twice and
// stopped, and the hours line is what shows it. Priya filed once. The trend
// only means anything with several weeks behind it, so the demo carries them.
export const DEMO_WEEKLY_UPDATES: {
  id: string; founderId: string; cohortId: string | null; weekStart: string;
  weekNumber: number | null; hours: string | null; conversations: string | null;
  runway: string | null; shipped: string | null; usersCount: number | null;
  payingCount: number | null; revenueCents: number | null; confidence: number | null;
  blocker: string | null; ask: string | null; answers: Record<string, unknown>;
  submittedAt: string;
}[] = [
  {
    id: "wk-alex-1", founderId: "u-alex", cohortId: "c-gvl7", weekStart: "2026-07-06", weekNumber: 1,
    hours: "full", conversations: "1_2", runway: "3_6", shipped: "Signed the first three gyms.",
    usersCount: 0, payingCount: 0, revenueCents: 0, confidence: 6,
    blocker: "I do not know whether to sell to the gyms or to the people who work out at them.",
    ask: "Anyone who has run a two-sided marketplace from zero.",
    answers: {
      hours: "full", conversations: "1_2", shipped: "Signed the first three gyms.",
      users_count: "0", paying_count: "0", revenue: "0", runway: "3_6", confidence: "6",
      blocker: "I do not know whether to sell to the gyms or to the people who work out at them.",
      ask: "Anyone who has run a two-sided marketplace from zero.", needs_changed: [],
    },
    submittedAt: "2026-07-12T18:00:00.000Z",
  },
  {
    id: "wk-alex-2", founderId: "u-alex", cohortId: "c-gvl7", weekStart: "2026-07-13", weekNumber: 2,
    hours: "full", conversations: "3_5", runway: "3_6", shipped: "Booking flow works end to end.",
    usersCount: 9, payingCount: 0, revenueCents: 0, confidence: 7,
    blocker: "Eight gyms live and four bookings. I cannot tell if that is a demand problem or a nobody-knows-we-exist problem.",
    ask: "", answers: {
      hours: "full", conversations: "3_5", shipped: "Booking flow works end to end.",
      users_count: "9", paying_count: "0", revenue: "0", runway: "3_6", confidence: "7",
      blocker: "Eight gyms live and four bookings. I cannot tell if that is a demand problem or a nobody-knows-we-exist problem.",
      ask: "", needs_changed: [],
    },
    submittedAt: "2026-07-19T20:10:00.000Z",
  },
  {
    id: "wk-alex-3", founderId: "u-alex", cohortId: "c-gvl7", weekStart: "2026-07-20", weekNumber: 3,
    hours: "15_30", conversations: "6_10", runway: "3_6", shipped: "Ran a paid test on Instagram.",
    usersCount: 21, payingCount: 3, revenueCents: 11000, confidence: 6,
    blocker: "Six hundred dollars of ads bought three bookings. That is not a channel.",
    ask: "A gym owner who would tell me the truth about why they signed up and then did nothing.",
    answers: {
      hours: "15_30", conversations: "6_10", shipped: "Ran a paid test on Instagram.",
      users_count: "21", paying_count: "3", revenue: "110", runway: "3_6", confidence: "6",
      blocker: "Six hundred dollars of ads bought three bookings. That is not a channel.",
      ask: "A gym owner who would tell me the truth about why they signed up and then did nothing.",
      needs_changed: [],
    },
    submittedAt: "2026-07-26T15:30:00.000Z",
  },
  {
    id: "wk-alex-4", founderId: "u-alex", cohortId: "c-gvl7", weekStart: "2026-07-27", weekNumber: 4,
    hours: "full", conversations: "6_10", runway: "3_6",
    shipped: "Wrote down the passive-side value prop and tested it on seven people.",
    usersCount: 34, payingCount: 5, revenueCents: 19000, confidence: 6,
    blocker: "Half the people I talked to are not on the channel we built the whole acquisition plan around.",
    ask: "", answers: {
      hours: "full", conversations: "6_10",
      shipped: "Wrote down the passive-side value prop and tested it on seven people.",
      users_count: "34", paying_count: "5", revenue: "190", runway: "3_6", confidence: "6",
      blocker: "Half the people I talked to are not on the channel we built the whole acquisition plan around.",
      ask: "", needs_changed: [],
    },
    submittedAt: "2026-08-02T22:05:00.000Z",
  },
  {
    id: "wk-jordan-1", founderId: "u-jordan", cohortId: "c-gvl7", weekStart: "2026-07-13", weekNumber: 2,
    hours: "5_15", conversations: "0", runway: "not_spending", shipped: "Onboarding screens.",
    usersCount: null, payingCount: null, revenueCents: null, confidence: 7,
    blocker: "Nothing really. Head down building.", ask: "",
    answers: {
      hours: "5_15", conversations: "0", shipped: "Onboarding screens.",
      users_count: "", paying_count: "", revenue: "", runway: "not_spending", confidence: "7",
      blocker: "Nothing really. Head down building.", ask: "", needs_changed: [],
    },
    submittedAt: "2026-07-19T23:40:00.000Z",
  },
  {
    id: "wk-jordan-2", founderId: "u-jordan", cohortId: "c-gvl7", weekStart: "2026-07-20", weekNumber: 3,
    hours: "under_5", conversations: "0", runway: "not_spending", shipped: "Not much this week.",
    usersCount: null, payingCount: null, revenueCents: null, confidence: 4,
    blocker: "I keep building and I have still not shown it to anyone. I think I am avoiding it.",
    ask: "", answers: {
      hours: "under_5", conversations: "0", shipped: "Not much this week.",
      users_count: "", paying_count: "", revenue: "", runway: "not_spending", confidence: "4",
      blocker: "I keep building and I have still not shown it to anyone. I think I am avoiding it.",
      ask: "", needs_changed: [],
    },
    submittedAt: "2026-07-26T21:15:00.000Z",
  },
  {
    id: "wk-priya-1", founderId: "u-priya", cohortId: "c-gvl7", weekStart: "2026-07-27", weekNumber: 4,
    hours: "full", conversations: "3_5", runway: "under_3",
    shipped: "Put the new price in front of two of the three firms.",
    usersCount: 3, payingCount: 3, revenueCents: 42000, confidence: 5,
    blocker: "Both of them said yes to the new price without blinking, which tells me I am still too cheap and I do not know how to find out by how much.",
    ask: "Someone who has priced a B2B product at this stage.",
    answers: {
      hours: "full", conversations: "3_5", shipped: "Put the new price in front of two of the three firms.",
      users_count: "3", paying_count: "3", revenue: "420", runway: "under_3", confidence: "5",
      blocker: "Both of them said yes to the new price without blinking, which tells me I am still too cheap and I do not know how to find out by how much.",
      ask: "Someone who has priced a B2B product at this stage.",
      needs_changed: ["pricing", "raising_money", "selling_b2b"],
    },
    submittedAt: "2026-08-01T14:20:00.000Z",
  },
];

// Founder intake and brief answers, so the mentor-facing view has something
// to render when clicking through in demo mode. Alex has done both; the other
// founders have done neither, which is the state the nudges are written for.
export const DEMO_FOUNDER_PROFILES: Record<string, {
  intake: Record<string, unknown> | null;
  intakeAt: string | null;
  brief: Record<string, unknown> | null;
  briefAt: string | null;
}> = {
  "u-alex": {
    intakeAt: "2026-07-20T14:00:00.000Z",
    intake: {
      phone: "864-555-0148",
      company: "Trellis",
      website: "https://trellis.test",
      linkedin: "https://linkedin.com/in/alexrivera",
      time_zone: "eastern",
      availability: "Weekday mornings, and most of Thursday",
      one_liner: "A booking marketplace that fills the empty hours at neighborhood gyms.",
      industry: "consumer",
      stage: "building",
      team: "cofounders",
      commitment: "full_time",
      needs: ["first_customers", "pricing", "strategy"],
      strengths: ["building_product"],
      biggest_challenge:
        "We have twelve gyms signed up and almost no bookings. I cannot tell whether the problem is that the gyms are wrong, the price is wrong, or that nobody knows we exist.",
      win: "A repeatable way to get bookings that does not depend on me texting people, and enough revenue to prove it works.",
      mentoring_format: "advisory",
      industry_pref: "not_much",
      ground_rules: true,
      anything_else: "",
    },
    briefAt: "2026-07-27T16:30:00.000Z",
    brief: {
      traction: "12 gyms live, 34 bookings in six weeks, $410 of revenue. Two gyms have asked to be removed.",
      recent_progress: "Rebuilt the booking flow, signed the first eight gyms, and ran a paid test that went nowhere.",
      tried: "Instagram ads, $600 total, three bookings. Flyers at four gyms. A referral code nobody used.",
      stuck: "Whether to keep selling to gyms or to go straight at the people who want the workout.",
      decision: "My co-founder wants to niche down to climbing gyms only. I am not convinced.",
      first_meeting: "A way to test the two-sided question in the next three weeks without rebuilding anything.",
      candor: "direct",
      context: "I left my job in March and have runway until about February.",
      links: "https://trellis.test and the deck is in the shared drive.",
    },
  },
};
