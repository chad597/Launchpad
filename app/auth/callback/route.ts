import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { linkOrRejectAuthUser } from "@/lib/invites";

// Where Google sends people back. Google will sign in anyone with a Google
// account, so this is the gate that decides whether they are in the program.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const fail = (reason: string) =>
    NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(reason)}`, url.origin));

  if (!code) return fail("That sign-in did not work");

  const sb = await supabaseServer();
  const { error } = await sb.auth.exchangeCodeForSession(code);
  if (error) return fail("That sign-in did not work");

  const { data: { user } } = await sb.auth.getUser();
  if (!user?.email) {
    await sb.auth.signOut();
    return fail("That sign-in did not work");
  }

  const result = await linkOrRejectAuthUser(user.id, user.email);
  if (!result.ok) {
    // Drop the session as well, or they hold a valid cookie with no account
    // behind it and every page bounces them.
    await sb.auth.signOut();
    return fail(result.reason ?? "That email is not on the program list");
  }

  return NextResponse.redirect(new URL("/", url.origin));
}
