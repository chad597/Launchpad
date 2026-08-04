// Identity seam used by every page. Production: Supabase Auth (a password the
// person set through an invite link, or Google), mapped to the app's users
// table by the auth-linking trigger. Demo mode: a cookie selects which seeded
// user you're browsing as.
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { isDemo } from "./supabase/server";
import { getUserByAuth } from "./db";
import { getUser as demoGetUser } from "./store";
import type { User } from "./types";

export const DEMO_IDENTITIES = ["u-alex", "u-sam", "u-chad"] as const;

export async function currentUser(): Promise<User> {
  if (isDemo()) {
    const jar = await cookies();
    const id = jar.get("demo_user")?.value ?? "u-alex";
    return demoGetUser(id) ?? demoGetUser("u-alex")!;
  }
  const user = await getUserByAuth();
  if (!user) redirect("/login");
  // Deactivating an account has to actually remove access, not just hide the
  // person from admin lists.
  if (user.status === "inactive") redirect("/login?error=This account is no longer active");
  return user;
}

export function homeForRole(role: User["role"]): string {
  switch (role) {
    case "founder": return "/founder";
    case "mentor": return "/mentor";
    default: return "/admin";
  }
}
