// Single-use invite and reset links.
//
// The program has no email service it can rely on, so nobody is invited by
// email. An admin generates a link, sends it by whatever channel they already
// use, and the person sets their own password. The raw token exists only in
// that URL: the database holds a hash, so a leaked table row cannot be
// replayed into someone's account.
import { createHash, randomBytes } from "crypto";
import { supabaseAdmin } from "./supabase/admin";

export type InvitePurpose = "invite" | "reset";

const INVITE_DAYS = 14;
const RESET_DAYS = 3;

function hash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssuedInvite {
  url: string;
  expiresAt: string;
}

export async function issueInvite(
  userId: string, purpose: InvitePurpose, createdBy: string, origin: string
): Promise<IssuedInvite | null> {
  const sb = supabaseAdmin();
  if (!sb) return null;

  // Only one live link per person: issuing a new one retires the old, so a
  // link that was sent to the wrong address stops working.
  await sb.from("invite_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("user_id", userId).is("used_at", null);

  const token = randomBytes(32).toString("base64url");
  const days = purpose === "invite" ? INVITE_DAYS : RESET_DAYS;
  const expiresAt = new Date(Date.now() + days * 86400000).toISOString();
  const { error } = await sb.from("invite_tokens").insert({
    user_id: userId, token_hash: hash(token), purpose, created_by: createdBy, expires_at: expiresAt,
  });
  if (error) return null;
  return { url: `${origin}/invite/${token}`, expiresAt };
}

export interface InviteCheck {
  ok: boolean;
  reason?: string;
  userId?: string;
  email?: string;
  name?: string;
  purpose?: InvitePurpose;
}

// Read-only check, used to render the page before anyone types a password.
export async function checkInvite(token: string): Promise<InviteCheck> {
  const sb = supabaseAdmin();
  if (!sb) return { ok: false, reason: "Invite links are not configured yet" };
  const { data } = await sb
    .from("invite_tokens").select("*").eq("token_hash", hash(token)).maybeSingle();
  if (!data) return { ok: false, reason: "This link is not valid" };
  if (data.used_at) return { ok: false, reason: "This link has already been used" };
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: false, reason: "This link has expired" };
  }
  const { data: user } = await sb
    .from("users").select("id, email, name, status").eq("id", data.user_id).maybeSingle();
  if (!user) return { ok: false, reason: "This link is not valid" };
  if (user.status === "inactive") return { ok: false, reason: "This account is no longer active" };
  return {
    ok: true, userId: user.id, email: user.email, name: user.name,
    purpose: data.purpose as InvitePurpose,
  };
}

// Sets the password and marks the link used. Creating the auth account here,
// already confirmed, is what keeps sign-up off the public internet: an auth
// user only ever exists for someone an admin added first.
export async function redeemInvite(
  token: string, password: string
): Promise<{ ok: boolean; email?: string; reason?: string }> {
  const check = await checkInvite(token);
  if (!check.ok || !check.userId || !check.email) {
    return { ok: false, reason: check.reason ?? "This link is not valid" };
  }
  const sb = supabaseAdmin();
  if (!sb) return { ok: false, reason: "Invite links are not configured yet" };

  const { data: existing } = await sb
    .from("users").select("auth_user_id").eq("id", check.userId).maybeSingle();

  if (existing?.auth_user_id) {
    const { error } = await sb.auth.admin.updateUserById(existing.auth_user_id, { password });
    if (error) return { ok: false, reason: error.message };
  } else {
    const { data: created, error } = await sb.auth.admin.createUser({
      email: check.email, password, email_confirm: true,
    });
    if (error || !created.user) {
      return { ok: false, reason: error?.message ?? "Could not create the account" };
    }
    // The auth-linking trigger matches on email, but link explicitly so this
    // does not depend on trigger timing.
    await sb.from("users").update({ auth_user_id: created.user.id }).eq("id", check.userId);
  }

  await sb.from("users")
    .update({ password_set_at: new Date().toISOString() }).eq("id", check.userId);
  await sb.from("invite_tokens")
    .update({ used_at: new Date().toISOString() }).eq("token_hash", hash(token));
  return { ok: true, email: check.email };
}

// Google sign-in creates the auth user before we get a say, so the callback
// has to decide whether that person belongs here at all.
export async function linkOrRejectAuthUser(
  authUserId: string, email: string
): Promise<{ ok: boolean; reason?: string }> {
  const sb = supabaseAdmin();
  // Without the service role we cannot verify or clean up, so refuse rather
  // than let an unknown account through.
  if (!sb) return { ok: false, reason: "Sign-in is not configured yet" };

  const { data: linked } = await sb
    .from("users").select("id, status").eq("auth_user_id", authUserId).maybeSingle();
  if (linked) {
    if (linked.status === "inactive") return { ok: false, reason: "This account is no longer active" };
    return { ok: true };
  }

  const { data: byEmail } = await sb
    .from("users").select("id, status, auth_user_id").eq("email", email.toLowerCase()).maybeSingle();
  if (!byEmail) {
    // Nobody by this address is in the program. Remove the auth account we
    // just caused, or the linking trigger will never fire for them again if
    // they are added later.
    await sb.auth.admin.deleteUser(authUserId);
    return { ok: false, reason: "That email is not on the program list" };
  }
  if (byEmail.status === "inactive") {
    await sb.auth.admin.deleteUser(authUserId);
    return { ok: false, reason: "This account is no longer active" };
  }
  if (byEmail.auth_user_id && byEmail.auth_user_id !== authUserId) {
    // They already sign in another way. Two auth accounts for one person would
    // split their history, so keep the original.
    await sb.auth.admin.deleteUser(authUserId);
    return { ok: false, reason: "Sign in with the password you set up, or ask for a new link" };
  }
  await sb.from("users").update({ auth_user_id: authUserId }).eq("id", byEmail.id);
  return { ok: true };
}
