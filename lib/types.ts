export type Role = "founder" | "mentor" | "admin";
export type StatusFlag = "on_track" | "at_risk" | "off_track";
export type PairingStatus = "proposed" | "active" | "paused" | "completed" | "dissolved";
export type MeetingStatus = "scheduled" | "completed" | "no_show" | "canceled";
export type ActionItemStatus = "open" | "done" | "dropped";
export type Health = "healthy" | "watch" | "attention";

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  company?: string;
  stage?: string;
  bio?: string;
  expertise?: string[];
  availability?: string;
  bookingLink?: string;
  capacity?: number;
  status?: "active" | "inactive";
  // Set the first time someone redeems an invite link, so admins can see who
  // still needs one sent.
  passwordSetAt?: string;

  // Everything below is an answer from one of the intake forms, copied onto
  // the user record because matching reads it. The full answer set stays in
  // profile_answers. Anything undefined means the question was never
  // answered, which the match report shows as unknown rather than as zero.
  phone?: string;
  title?: string;
  linkedin?: string;
  website?: string;
  timeZone?: string;
  // Both sides: which worlds they have operated in. A founder's is stored as
  // a one-element array so the two join the same way.
  industries?: string[];
  mentoringFormat?: string;

  // Mentor answers
  yearsExperience?: string;
  background?: string[];
  skills?: string[];        // ranked, strongest first
  avoidSkills?: string[];
  story?: string;
  tracks?: string[];
  stagePreference?: string;
  conflicts?: string;
  mentorMotivation?: string;

  // Founder answers
  founderStage?: string;
  teamShape?: string;
  timeCommitment?: string;
  needs?: string[];         // ranked, most pressing first
  strengths?: string[];
  challenge?: string;
  goal?: string;
  industryPref?: string;
}

export interface AuditEntry {
  id: string;
  actorId: string | null;
  actorName?: string;
  action: string;
  subjectType: string;
  subjectId: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface Cohort {
  id: string;
  ecosystem: string;
  name: string;
  startDate: string; // ISO date
  status: "intake" | "active" | "completed";
}

export interface Pairing {
  id: string;
  cohortId: string;
  founderId: string;
  mentorId: string;
  status: PairingStatus;
  declaredCadence: "weekly" | "biweekly" | "monthly" | "as_needed";
  matchRationale: string;
  // When the pair was matched. Health counts from here until they first meet,
  // so a new pairing is not scored as if a meeting were years overdue.
  createdAt: string;
}

export interface Meeting {
  id: string;
  pairingId: string;
  scheduledAt: string; // ISO datetime
  status: MeetingStatus;
  weekNumber: number;
}

export interface FounderSection {
  actionItemCheckIds: string[]; // last meeting's items confirmed done
  whatMoved: string[];
  whatChangedMyThinking: string;
  whereINeedHelp: string;
  focusNextWeek: string[];
}

export interface MentorSection {
  read: string;
  whatImSeeing: string[];
  risks: string[];
  focusAdjustments: string[];
  myTake: string;
}

export interface MeetingNote {
  id: string;
  meetingId: string;
  statusFlag: StatusFlag | null;
  confidence: number | null; // 1..10
  founderSection: FounderSection | null;
  mentorSection: MentorSection | null;
  keyInsight: string | null;
  decisionMade: string | null;
  founderSubmittedAt: string | null;
  mentorSubmittedAt: string | null;
}

export interface ActionItem {
  id: string;
  meetingId: string;
  pairingId: string;
  description: string;
  ownerId: string;
  dueDate: string; // ISO date
  status: ActionItemStatus;
}

export interface Message {
  id: string;
  pairingId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

export interface Flag {
  id: string;
  raisedById: string;
  pairingId: string | null;
  category: "pattern_risk" | "match_not_working" | "conduct" | "other";
  body: string;
  status: "open" | "resolved";
  createdAt: string;
}

export interface MatchSuggestion {
  id: string;
  founderId: string;
  mentorId: string;
  score: number;
  breakdown: string[]; // chip labels
  rationale: string;
  status: "suggested" | "selected" | "rejected";
}

export interface PairHealth {
  pairing: Pairing;
  founder: User;
  mentor: User;
  health: Health;
  lastMetDaysAgo: number | null;
  nextMeeting: Meeting | null;
  notesComplete: number;
  notesExpected: number;
  signal: string;
  // How often they actually meet, in days. Null until they have met twice.
  rhythmDays: number | null;
}
