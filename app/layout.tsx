import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { DEMO_IDENTITIES } from "@/lib/session";
import { isDemo } from "@/lib/supabase/server";
import { getUser as demoGetUser } from "@/lib/store";
import { getUserByAuth } from "@/lib/db";
import { getCohort, weekNumber } from "@/lib/data";
import { signOut, switchIdentity } from "./actions";
import { MainNav } from "./nav";
import { cookies } from "next/headers";
import type { User } from "@/lib/types";

export const metadata: Metadata = {
  title: "Launchpad Mentor App",
  description: "Mentorship matching, meeting notes, and program health for Launchpad Tech Ventures",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const demo = isDemo();

  // Resolve the viewer without redirecting; the login page renders bare.
  let user: User | null = null;
  if (demo) {
    const jar = await cookies();
    const id = jar.get("demo_user")?.value ?? "u-alex";
    user = demoGetUser(id) ?? demoGetUser("u-alex")!;
  } else {
    user = await getUserByAuth();
  }

  let bar: React.ReactNode = null;
  if (user) {
    const cohort = await getCohort();
    const week = await weekNumber();
    bar = (
      <div className="appbar">
        <Link className="logo" href="/" aria-label="Back to your dashboard">
          <span className="mark" />LAUNCHPAD
        </Link>
        <div className="who">
          <span>{cohort.ecosystem} · {cohort.name} · Week {week} of 12</span>
          <b>{user.name}</b>
          {demo ? (
            <form action={switchIdentity} className="rolebar" aria-label="Demo: browse as">
              {DEMO_IDENTITIES.map((id) => {
                const u = demoGetUser(id)!;
                return (
                  <button key={id} name="id" value={id} className={u.id === user!.id ? "active" : ""}>
                    {u.role === "admin" ? "Admin" : u.role === "mentor" ? "Mentor" : "Founder"}
                  </button>
                );
              })}
            </form>
          ) : (
            <form action={signOut}>
              <button className="linklike">Sign out</button>
            </form>
          )}
        </div>
      </div>
    );
  }

  return (
    <html lang="en">
      <body>
        {bar}
        {user && <MainNav role={user.role} />}
        {children}
      </body>
    </html>
  );
}
