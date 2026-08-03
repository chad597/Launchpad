export type Role = "founder" | "mentor" | "instructor" | "admin";
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
}
