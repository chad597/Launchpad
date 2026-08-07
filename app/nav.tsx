"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

// One nav for everyone, so no page is a dead end. Each role only sees the
// pages it can actually open.
const TABS = {
  founder: [
    { href: "/founder", label: "Home" },
    { href: "/weekly", label: "Weekly update" },
    { href: "/meetings", label: "Meetings and notes" },
    { href: "/flag", label: "Tell the team" },
  ],
  mentor: [
    { href: "/mentor", label: "Your founders" },
    { href: "/meetings", label: "Meetings and notes" },
    { href: "/mentor/availability", label: "Availability" },
    { href: "/flag", label: "Tell the team" },
  ],
  admin: [
    { href: "/admin", label: "Health board" },
    { href: "/admin/weekly", label: "This week" },
    { href: "/admin/people", label: "People" },
    { href: "/admin/import", label: "Import" },
    { href: "/admin/applicants", label: "Applicants" },
    { href: "/admin/forms", label: "Forms" },
    { href: "/admin/cohorts", label: "Cohorts" },
    { href: "/admin/pairings", label: "Pairings" },
    { href: "/admin/matches", label: "Match report" },
    { href: "/admin/report", label: "Cohort report" },
    { href: "/admin/audit", label: "Audit log" },
  ],
} as const;

export function MainNav({ role }: { role: "founder" | "mentor" | "admin" }) {
  const path = usePathname();
  const tabs = TABS[role];

  // The longest matching href wins, so /admin/people does not also light up
  // /admin.
  const active = tabs
    .filter((t) => path === t.href || path.startsWith(t.href + "/"))
    .sort((a, b) => b.href.length - a.href.length)[0];

  return (
    <nav className="mainnav" aria-label="Sections">
      <div className="wrap">
        {tabs.map((t) => (
          <Link key={t.href} href={t.href} className={t === active ? "active" : ""}>
            {t.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
