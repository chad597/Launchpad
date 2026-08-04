import Link from "next/link";

const TABS = [
  { href: "/admin", label: "Health board" },
  { href: "/admin/people", label: "People" },
  { href: "/admin/cohorts", label: "Cohorts" },
  { href: "/admin/pairings", label: "Pairings" },
  { href: "/admin/audit", label: "Audit log" },
];

export function AdminNav({ current }: { current: string }) {
  return (
    <nav className="adminnav" aria-label="Admin sections">
      {TABS.map((t) => (
        <Link key={t.href} href={t.href} className={t.href === current ? "active" : ""}>
          {t.label}
        </Link>
      ))}
    </nav>
  );
}
