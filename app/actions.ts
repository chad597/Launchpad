"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  confirmMatch, getUser, resolveFlag, sendMessage, submitMentorHalf, toggleActionItem,
} from "@/lib/store";
import { homeForRole } from "@/lib/session";

export async function switchIdentity(formData: FormData) {
  const id = String(formData.get("id") ?? "u-alex");
  const jar = await cookies();
  jar.set("demo_user", id, { path: "/" });
  const user = getUser(id);
  redirect(homeForRole(user?.role ?? "founder"));
}

export async function postMessage(formData: FormData) {
  const pairingId = String(formData.get("pairingId"));
  const senderId = String(formData.get("senderId"));
  const body = String(formData.get("body") ?? "").trim();
  if (body) sendMessage(pairingId, senderId, body);
  revalidatePath(`/messages/${pairingId}`);
}

export async function completeMentorHalf(formData: FormData) {
  const meetingId = String(formData.get("meetingId"));
  const actions: { description: string; ownerId: string; dueDate: string }[] = [];
  for (let i = 0; i < 3; i++) {
    actions.push({
      description: String(formData.get(`action_${i}`) ?? ""),
      ownerId: String(formData.get(`action_owner_${i}`) ?? ""),
      dueDate: String(formData.get(`action_due_${i}`) ?? ""),
    });
  }
  submitMentorHalf(
    meetingId,
    {
      read: String(formData.get("read") ?? ""),
      whatImSeeing: String(formData.get("seeing") ?? "").split("\n").filter(Boolean),
      risks: String(formData.get("risks") ?? "").split("\n").filter(Boolean),
      focusAdjustments: String(formData.get("focus") ?? "").split("\n").filter(Boolean),
      myTake: String(formData.get("take") ?? ""),
    },
    {
      keyInsight: String(formData.get("keyInsight") ?? ""),
      decisionMade: String(formData.get("decisionMade") ?? ""),
      actions,
    }
  );
  revalidatePath("/", "layout");
  redirect(`/note/${meetingId}`);
}

export async function markActionItem(formData: FormData) {
  toggleActionItem(String(formData.get("id")));
  revalidatePath("/", "layout");
}

export async function closeFlag(formData: FormData) {
  resolveFlag(String(formData.get("id")));
  revalidatePath("/admin");
}

export async function selectMatch(formData: FormData) {
  confirmMatch(String(formData.get("suggestionId")));
  revalidatePath("/admin");
}
