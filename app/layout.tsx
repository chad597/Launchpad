import type { Metadata } from "next";
import "./globals.css";
import { currentUser, DEMO_IDENTITIES } from "@/lib/session";
import { getCohort, getUser, weekNumber } from "@/lib/store";
import { switchIdentity } from "./actions";

export const metadata: Metadata = {
  title: "Launchpad Mentor App",
  description: "Mentorship matching, meeting notes, and program health for Launchpad Tech Ventures",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  const cohort = getCohort();

  return (
    <html lang="en">
      <body>
        <div className="appbar">
          <div className="logo"><span className="mark" />LAUNCHPAD</div>
          <div className="who">
            <span>{cohort.ecosystem} · {cohort.name} · Week {weekNumber()} of 12</span>
            <b>{user.name}</b>
            <form action={switchIdentity} className="rolebar" aria-label="Demo: browse as">
              {DEMO_IDENTITIES.map((id) => {
                const u = getUser(id)!;
                return (
                  <button key={id} name="id" value={id} className={u.id === user.id ? "active" : ""}>
                    {u.role === "admin" ? "Admin" : u.role === "mentor" ? "Mentor" : "Founder"}
                  </button>
                );
              })}
            </form>
          </div>
        </div>
        {children}
      </body>
    </html>
  );
}
