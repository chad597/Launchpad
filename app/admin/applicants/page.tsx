import Link from "next/link";
import { currentUser } from "@/lib/session";
import { getFormForEditing, listApplications } from "@/lib/forms";
import { answerToText } from "@/lib/mentor-form";
import { AdminNav } from "../nav";

const STATUSES = ["new", "reviewing", "accepted", "declined"] as const;
const STATUS_PILL = { new: "info", reviewing: "warn", accepted: "good", declined: "crit" } as const;

function fmt(dt: string) {
  return new Date(dt).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });
}

export default async function ApplicantsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const user = await currentUser();
  if (user.role !== "admin") {
    return <div className="wrap"><p className="meta">This view is for program staff.</p></div>;
  }
  const { status } = await searchParams;
  const [form, all] = await Promise.all([
    getFormForEditing("mentor-application"),
    listApplications(),
  ]);
  const rows = status ? all.filter((a) => a.status === status) : all;

  // One column per question, generated from the live definition. Adding a
  // question in the editor adds a column here.
  const columns = (form?.questions ?? []).filter(
    (q) => q.type !== "statement" && !["first_name", "last_name", "email"].includes(q.key)
  );

  return (
    <div className="wrap">
      <AdminNav current="/admin/applicants" />
      <h1 className="page">Potential mentors</h1>
      <p className="sub">
        Everyone who has applied at <code>/apply</code>. Accepting someone creates their mentor account and sends them to the profile form at first sign-in.
      </p>

      <div className="stat-row">
        {STATUSES.map((s) => (
          <div className="stat" key={s}>
            <div className="n">{all.filter((a) => a.status === s).length}</div>
            <div className="l" style={{ textTransform: "capitalize" }}>{s}</div>
          </div>
        ))}
      </div>

      <div className="adminnav" style={{ borderBottom: "none", marginBottom: ".6rem" }}>
        <a href="/admin/applicants" className={!status ? "active" : ""}>All</a>
        {STATUSES.map((s) => (
          <a key={s} href={`/admin/applicants?status=${s}`} className={status === s ? "active" : ""}
            style={{ textTransform: "capitalize" }}>{s}</a>
        ))}
        <a href="/admin/applicants/export" style={{ marginLeft: "auto" }}>Download CSV</a>
      </div>

      {rows.length === 0 ? (
        <div className="card"><p className="meta" style={{ margin: 0 }}>
          No applications yet. The form is live at <a href="/apply">/apply</a>.
        </p></div>
      ) : (
        <div className="tablewrap">
          <table className="board">
            <thead>
              <tr>
                <th>Name</th><th>Email</th><th>Status</th><th>Applied</th>
                {columns.map((c) => <th key={c.key}>{c.label}{c.archived ? " (removed)" : ""}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id}>
                  <td><Link href={`/admin/applicants/${a.id}`}>{a.name}</Link></td>
                  <td className="meta">{a.email}</td>
                  <td><span className={`pill ${STATUS_PILL[a.status]}`}>{a.status}</span></td>
                  <td className="meta" style={{ whiteSpace: "nowrap" }}>{fmt(a.submittedAt)}</td>
                  {columns.map((c) => (
                    <td key={c.key} className="meta cell-clip">{answerToText(c, a.answers[c.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
