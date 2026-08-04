import { createClient } from "@supabase/supabase-js";

// Service-role client. It bypasses RLS, so it never leaves the server and is
// only used for the two things a browser session cannot do: create the auth
// account behind an invite link, and read the single-use token that proves
// the link is genuine.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// Invite links are useless without it, so the admin screens check first and
// say so plainly rather than failing halfway through.
export function canIssueInvites(): boolean {
  return !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.SUPABASE_SERVICE_ROLE_KEY;
}

// Google sign-in only appears once the provider is actually configured.
export function googleEnabled(): boolean {
  return process.env.GOOGLE_SIGN_IN === "true";
}
