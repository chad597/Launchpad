// Demo-mode identity: a cookie selects which seeded user you're browsing as.
// In production this is replaced by Supabase Auth (magic links); the seam is
// currentUser(), which every page calls.
import { cookies } from "next/headers";
import { getUser } from "./store";
import type { User } from "./types";

export const DEMO_IDENTITIES = ["u-alex", "u-sam", "u-chad"] as const;

export async function currentUser(): Promise<User> {
  const jar = await cookies();
  const id = jar.get("demo_user")?.value ?? "u-alex";
  return getUser(id) ?? getUser("u-alex")!;
}

export function homeForRole(role: User["role"]): string {
  switch (role) {
    case "founder": return "/founder";
    case "mentor": return "/mentor";
    default: return "/admin";
  }
}
