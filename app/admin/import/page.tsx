import { currentUser } from "@/lib/session";
import { listCohorts, listUsers } from "@/lib/data";
import { AdminNav } from "../nav";
import { ImportClient } from "./import-client";

export default async function ImportPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await currentUser();
  if (user.role !== "admin") {
    return <div className="wrap"><p className="meta">This view is for program admins.</p></div>;
  }
  const { error } = await searchParams;
  const [users, cohorts] = await Promise.all([listUsers(), listCohorts()]);

  return (
    <div className="wrap">
      <AdminNav current="/admin/import" />
      <h1 className="page">Import people</h1>
      <p className="sub">
        Bring founders and mentors over from HubSpot. Everyone is matched by email address, so the column you export has to be the address they will sign in with.
      </p>
      {error && <div className="banner bad">{error}</div>}
      <ImportClient
        existingEmails={users.map((u) => u.email)}
        cohorts={cohorts.map((c) => ({ id: c.id, name: c.name, ecosystem: c.ecosystem }))}
      />
    </div>
  );
}
