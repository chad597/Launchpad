import { currentUser } from "@/lib/session";
import { listAudit } from "@/lib/data";
import { AdminNav } from "../nav";

const LABEL: Record<string, string> = {
  "person.created": "Added a person",
  "person.role_changed": "Changed a role",
  "person.deactivated": "Deactivated an account",
  "person.reactivated": "Reactivated an account",
  "cohort.created": "Created a cohort",
  "cohort.status_changed": "Changed cohort status",
  "cohort.pool_updated": "Updated the 1:1 mentor pool",
  "pairing.created": "Created a pairing",
  "pairing.updated": "Updated a pairing",
  "match.confirmed": "Confirmed a match",
  "flag.resolved": "Resolved a flag",
  "messages.read_by_staff": "Read a pair's conversation",
};

function fmt(dt: string) {
  return new Date(dt).toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });
}

function detail(metadata: Record<string, unknown>) {
  const parts = Object.entries(metadata)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${k}: ${String(v)}`);
  return parts.join(" · ");
}

export default async function AuditPage() {
  const user = await currentUser();
  if (user.role !== "admin" && user.role !== "instructor") {
    return <div className="wrap"><p className="meta">This view is for program staff.</p></div>;
  }
  const entries = await listAudit(200);

  return (
    <div className="wrap">
      <AdminNav current="/admin/audit" role={user.role} />
      <h1 className="page">Audit log</h1>
      <p className="sub">
        Who did what, and when. Entries are written automatically and cannot be edited or removed, including staff access to a pair&rsquo;s conversation.
      </p>

      {entries.length === 0 ? (
        <div className="card"><p className="meta" style={{ margin: 0 }}>Nothing recorded yet. Entries appear as soon as staff make changes.</p></div>
      ) : (
        <div className="tablewrap">
          <table className="board">
            <thead>
              <tr><th>When</th><th>Who</th><th>What</th><th>Details</th></tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td className="meta" style={{ whiteSpace: "nowrap" }}>{fmt(e.createdAt)}</td>
                  <td>{e.actorName ?? "System"}</td>
                  <td>{LABEL[e.action] ?? e.action}</td>
                  <td className="meta">{detail(e.metadata)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
