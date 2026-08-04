import Link from "next/link";

// Instructors see only what they can actually open, so the nav never leads
// them into a dead end.
const TABS = [
  { href: "/admin", label: "Health board", instructor: true },
  { href: "/admin/people", label: "People", instructor: false },
  { href: "/admin/import", label: "Import", instructor: false },
  { href: "/admin/applicants", label: "Applicants", instructor: true },
  { href: "/admin/forms", label: "Forms", instructor: false },
  { href: "/admin/cohorts", label: "Cohorts", instructor: false },
  { href: "/admin/pairings", label: "Pairings", instructor: false },
  { href: "/admin/audit", label: "Audit log", instructor: true },
];

export function AdminNav({ current, role }: { current: string; role?: string }) {
  const tabs = role === "instructor" ? TABS.filter((t) => t.instructor) : TABS;
  return (
    <nav className="adminnav" aria-label="Admin sections">
      {tabs.map((t) => (
        <Link key={t.href} href={t.href} className={t.href === current ? "active" : ""}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
