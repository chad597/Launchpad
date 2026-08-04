// Async data facade: every page and action goes through here. Demo mode uses
// the in-memory store; production uses Supabase with row-level security.
import { isDemo } from "./supabase/server";
import * as demo from "./store";
import * as db from "./db";
import type {
  ActionItem, Cohort, Flag, MatchSuggestion, Meeting, MeetingNote, MentorSection,
  Message, PairHealth, Pairing, User,
} from "./types";

export async function getUser(id: string): Promise<User | undefined> {
  return isDemo() ? demo.getUser(id) : db.getUser(id);
}
export async function getCohort(): Promise<Cohort> {
  return isDemo() ? demo.getCohort() : db.getCohort();
}
export async function weekNumber(): Promise<number> {
  return isDemo() ? demo.weekNumber() : db.weekNumber();
}
export async function pairingsForUser(userId: string): Promise<Pairing[]> {
  return isDemo() ? demo.pairingsForUser(userId) : db.pairingsForUser(userId);
}
export async function getPairing(id: string): Promise<Pairing | undefined> {
  return isDemo() ? demo.getPairing(id) : db.getPairing(id);
}
export async function meetingsForPairing(id: string): Promise<Meeting[]> {
  return isDemo() ? demo.meetingsForPairing(id) : db.meetingsForPairing(id);
}
export async function getMeeting(id: string): Promise<Meeting | undefined> {
  return isDemo() ? demo.getMeeting(id) : db.getMeeting(id);
}
export async function noteForMeeting(meetingId: string): Promise<MeetingNote | undefined> {
  return isDemo() ? demo.noteForMeeting(meetingId) : db.noteForMeeting(meetingId);
}
export async function actionItemsForPairing(id: string): Promise<ActionItem[]> {
  return isDemo() ? demo.actionItemsForPairing(id) : db.actionItemsForPairing(id);
}
export async function messagesForPairing(id: string): Promise<Message[]> {
  return isDemo() ? demo.messagesForPairing(id) : db.messagesForPairing(id);
}
export async function openFlags(): Promise<Flag[]> {
  return isDemo() ? demo.openFlags() : db.openFlags();
}
export async function suggestionsForFounder(founderId: string): Promise<MatchSuggestion[]> {
  return isDemo() ? demo.suggestionsForFounder(founderId) : db.suggestionsForFounder(founderId);
}
export async function nextMeetingForPairing(id: string): Promise<Meeting | null> {
  return isDemo() ? demo.nextMeetingForPairing(id) : db.nextMeetingForPairing(id);
}
export async function lastCompletedMeeting(id: string): Promise<Meeting | null> {
  return isDemo() ? demo.lastCompletedMeeting(id) : db.lastCompletedMeeting(id);
}
export async function cohortHealthBoard(): Promise<PairHealth[]> {
  return isDemo() ? demo.cohortHealthBoard() : db.cohortHealthBoard();
}
export async function currentTime(): Promise<Date> {
  return isDemo() ? demo.now() : new Date();
}

export async function sendMessage(pairingId: string, senderId: string, body: string) {
  return isDemo() ? demo.sendMessage(pairingId, senderId, body) : db.sendMessage(pairingId, senderId, body);
}
export async function submitMentorHalf(
  meetingId: string,
  section: MentorSection,
  outcomes: { keyInsight: string; decisionMade: string; actions: { description: string; ownerId: string; dueDate: string }[] }
) {
  return isDemo()
    ? demo.submitMentorHalf(meetingId, section, outcomes)
    : db.submitMentorHalf(meetingId, section, outcomes);
}
export async function toggleActionItem(id: string) {
  return isDemo() ? demo.toggleActionItem(id) : db.toggleActionItem(id);
}
export async function resolveFlag(id: string) {
  return isDemo() ? demo.resolveFlag(id) : db.resolveFlag(id);
}
export async function confirmMatch(suggestionId: string) {
  return isDemo() ? demo.confirmMatch(suggestionId) : db.confirmMatch(suggestionId);
}
