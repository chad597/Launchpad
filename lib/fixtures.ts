// Demo-mode seed data. Mirrors supabase/seed.sql so the app behaves the same
// before and after the real database exists. The Rivera/Patel meeting content
// comes from the worked example in the Launchpad meeting-note guides.
import type {
  ActionItem, Cohort, Flag, MatchSuggestion, Meeting, MeetingNote, Message, Pairing, User,
} from "./types";

// Week 4 of Cohort 7 anchors "today" for the demo so dates stay coherent.
export const DEMO_TODAY = "2026-08-03T12:00:00.000Z";

export const users: User[] = [
  { id: "u-chad", email: "chad@launchpad.test", name: "Chad Hensel", role: "admin" },
  { id: "u-alex", email: "alex@trellis.test", name: "Alex Rivera", role: "founder", company: "Trellis", stage: "Idea stage, two-sided marketplace" },
  { id: "u-jordan", email: "jordan@fernway.test", name: "Jordan Lee", role: "founder", company: "Fernway", stage: "Idea stage, consumer app" },
  { id: "u-priya", email: "priya@lucent.test", name: "Priya Nguyen", role: "founder", company: "Lucent Pay", stage: "Pre-revenue, B2B fintech" },
  { id: "u-marcusb", email: "marcus@okafor.test", name: "Ade Okafor", role: "founder", company: "Plotline", stage: "Idea stage, creator tools" },
  { id: "u-rosa", email: "rosa@marsh.test", name: "Rosa Marsh", role: "founder", company: "Kindling", stage: "First customers, B2B services" },
  // In the cohort, no intake answers and no mentor yet, which is what every
  // founder looks like in week 1.
  { id: "u-nia", email: "nia@sagepath.test", name: "Nia Chambers", role: "founder", company: "Sagepath" },
  { id: "u-sam", email: "sam@mentor.test", name: "Sam Patel", role: "mentor", bio: "Founder, 2 exits", expertise: ["Marketplaces", "Customer discovery", "Early GTM"] },
  { id: "u-brooks", email: "brooks@mentor.test", name: "Casey Brooks", role: "mentor", bio: "SaaS operator", expertise: ["B2B sales", "Hiring"] },
  { id: "u-grant", email: "grant@mentor.test", name: "R. Grant", role: "mentor", bio: "3x founder", expertise: ["Validation", "Product"] },
  { id: "u-deluca", email: "deluca@mentor.test", name: "Mia DeLuca", role: "mentor", bio: "Services founder, 1 exit", expertise: ["B2B services", "Pricing"] },
  { id: "u-dana", email: "dana@mentor.test", name: "Dana Whitfield", role: "mentor", bio: "FinTech founder, 1 exit", expertise: ["FinTech", "Pricing", "Fundraising"] },
  { id: "u-hale", email: "hale@mentor.test", name: "Marcus Hale", role: "mentor", bio: "Payments PM, 12 yrs", expertise: ["Payments", "Partnerships"] },
  { id: "u-cruz", email: "cruz@mentor.test", name: "Elena Cruz", role: "mentor", bio: "B2B SaaS founder", expertise: ["Sales", "SaaS"] },
];

export const cohorts: Cohort[] = [
  { id: "c-gvl7", ecosystem: "Greenville", name: "Cohort 7", startDate: "2026-07-06", status: "active" },
];

export const pairings: Pairing[] = [
  {
    id: "p-rivera", cohortId: "c-gvl7", founderId: "u-alex", mentorId: "u-sam",
    status: "active", declaredCadence: "biweekly",
    matchRationale: "Sam built and sold two marketplace companies and has coached founders through the exact two-sided discovery problem Trellis is working on now.",
  },
  {
    id: "p-lee", cohortId: "c-gvl7", founderId: "u-jordan", mentorId: "u-sam",
    status: "active", declaredCadence: "weekly",
    matchRationale: "Sam's consumer-adjacent marketplace experience matches Fernway's early validation questions.",
  },
  {
    id: "p-nguyen", cohortId: "c-gvl7", founderId: "u-priya", mentorId: "u-brooks",
    status: "active", declaredCadence: "biweekly",
    matchRationale: "Casey's B2B sales background matched Priya's go-to-market questions.",
  },
  {
    id: "p-okafor", cohortId: "c-gvl7", founderId: "u-marcusb", mentorId: "u-grant",
    status: "active", declaredCadence: "biweekly",
    matchRationale: "Grant has taken three products through early validation.",
  },
  {
    id: "p-marsh", cohortId: "c-gvl7", founderId: "u-rosa", mentorId: "u-deluca",
    status: "active", declaredCadence: "weekly",
    matchRationale: "Mia built and sold a services company one stage ahead of Kindling.",
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
