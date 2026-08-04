"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { cookies, headers } from "next/headers";
import * as data from "@/lib/data";
import { currentUser, homeForRole } from "@/lib/session";
import { isDemo, supabaseServer } from "@/lib/supabase/server";
import { getUser as demoGetUser } from "@/lib/store";

// ---- auth ----

export async function signIn(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) redirect("/login?error=Enter your email address");
  const sb = await supabaseServer();
  const h = await headers();
  const origin = h.get("origin") ?? h.get("x-forwarded-host") ?? "";
  const base = origin.startsWith("http") ? origin : `https://${origin}`;
  const { error } = await sb.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${base}/auth/callback` },
  });
  if (error) redirect(`/login?error=${encodeURIComponent(error.message)}`);
  redirect("/login?sent=1");
}

export async function signOut() {
  const sb = await supabaseServer();
  await sb.auth.signOut();
  redirect("/login");
}

export async function switchIdentity(formData: FormData) {
  if (!isDemo()) redirect("/");
  const id = String(formData.get("id") ?? "u-alex");
  const jar = await cookies();
  jar.set("demo_user", id, { path: "/" });
  const user = demoGetUser(id);
  redirect(homeForRole(user?.role ?? "founder"));
}

// ---- app actions (sender identity always comes from the session) ----

export async function postMessage(formData: FormData) {
  const user = await currentUser();
  const pairingId = String(formData.get("pairingId"));
  const body = String(formData.get("body") ?? "").trim();
  const pairing = await data.getPairing(pairingId);
  if (!pairing || (pairing.founderId !== user.id && pairing.mentorId !== user.id)) return;
  if (body) await data.sendMessage(pairingId, user.id, body);
  revalidatePath(`/messages/${pairingId}`);
}

export async function completeMentorHalf(formData: FormData) {
  const user = await currentUser();
  const meetingId = String(formData.get("meetingId"));
  const meeting = await data.getMeeting(meetingId);
  if (!meeting) return;
  const pairing = await data.getPairing(meeting.pairingId);
  if (!pairing || pairing.mentorId !== user.id) return;

  const actions: { description: string; ownerId: string; dueDate: string }[] = [];
  for (let i = 0; i < 3; i++) {
    actions.push({
      description: String(formData.get(`action_${i}`) ?? ""),
      ownerId: String(formData.get(`action_owner_${i}`) ?? ""),
      dueDate: String(formData.get(`action_due_${i}`) ?? ""),
    });
  }
  await data.submitMentorHalf(
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
  const user = await currentUser();
  const id = String(formData.get("id"));
  const pairingId = String(formData.get("pairingId") ?? "");
  if (pairingId) {
    const pairing = await data.getPairing(pairingId);
    if (!pairing || (pairing.founderId !== user.id && pairing.mentorId !== user.id && user.role !== "admin")) return;
  }
  await data.toggleActionItem(id);
  revalidatePath("/", "layout");
}

export async function closeFlag(formData: FormData) {
  const user = await currentUser();
  if (user.role !== "admin") return;
  await data.resolveFlag(String(formData.get("id")));
  revalidatePath("/admin");
}

export async function selectMatch(formData: FormData) {
  const user = await currentUser();
  if (user.role !== "admin") return;
  await data.confirmMatch(String(formData.get("suggestionId")));
  revalidatePath("/admin");
}
