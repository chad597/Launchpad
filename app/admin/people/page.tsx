import Link from "next/link";
import { currentUser } from "@/lib/session";
import { listUsers } from "@/lib/data";
import { canIssueInvites } from "@/lib/supabase/admin";
import { addPerson, changeRole, changeStatus, createInviteLink } from "../../actions";
import { InviteLinkBanner } from "./invite-link";

const ROLES = ["founder", "mentor", "admin"] as const;
const ROLE_LABEL = {
  founder: "Founder", mentor: "Mentor", admin: "Admin",
} as const;

export default async function PeoplePage({
  searchParams,
}: {
  searchParams: Promise<{
    role?: string; added?: string; error?: string; link?: string; for?: string;
  }>;
}) {
  const user = await currentUser();
  if (user.role !== "admin") {
    return <div className="wrap"><p className="meta">This view is for program admins.</p></div>;
  }
  const { role: filter, added, error, link, for: linkFor } = await searchParams;
  const invitesReady = canIssueInvites();
  const all = await listUsers();
  const people = filter ? all.filter((p) => p.role === filter) : all;
  const counts = ROLES.map((r) => ({ role: r, n: all.filter((p) => p.role === r).length }));

  return (
    <div className="wrap">
      <h1 className="page">People</h1>
      <p className="sub">
        Everyone with access to the app. Adding someone here creates their account. Then send them a sign-in link and they choose their own password. The email must match the one they will sign in with.
      </p>
      {link && <InviteLinkBanner url={link} name={linkFor ?? "them"} />}
      {added && <div className="banner ok">{added} added. Send them a sign-in link to finish setting up.</div>}
      {error && <div className="banner bad">{error}</div>}
      {!invitesReady && (
        <div className="banner bad">
          Sign-in links need SUPABASE_SERVICE_ROLE_KEY in the environment. Until it is set, nobody new can get in.
        </div>
      )}

      <div className="stat-row">
        {counts.map((c) => (
          <div className="stat" key={c.role}>
            <div className="n">{c.n}</div>
            <div className="l">{ROLE_LABEL[c.role]}{c.n === 1 ? "" : "s"}</div>
          </div>
        ))}
      </div>

      <div className="adminnav" style={{ borderBottom: "none", marginBottom: ".6rem" }}>
        <a href="/admin/people" className={!filter ? "active" : ""}>All</a>
        {ROLES.map((r) => (
          <a key={r} href={`/admin/people?role=${r}`} className={filter === r ? "active" : ""}>
            {ROLE_LABEL[r]}s
          </a>
        ))}
      </div>

      <div className="tablewrap">
        <table className="board">
          <thead>
            <tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th>Access</th><th>Details</th><th></th></tr>
          </thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} style={p.status === "inactive" ? { opacity: 0.55 } : undefined}>
                <td>{p.name}{p.id === user.id && <span className="meta"> (you)</span>}</td>
                <td className="meta">{p.email}</td>
                <td>
                  <form action={changeRole} className="inline-form">
                    <input type="hidden" name="id" value={p.id} />
                    <select name="role" defaultValue={p.role} aria-label={`Role for ${p.name}`}>
                      {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
                    </select>
                    <button className="linklike">Save</button>
                  </form>
                </td>
                <td>
                  <span className={`pill ${p.status === "inactive" ? "crit" : "good"}`}>
                    {p.status === "inactive" ? "Inactive" : "Active"}
                  </span>
                </td>
                <td>
                  {p.passwordSetAt
                    ? <span className="pill good">Password set</span>
                    : <span className="pill warn">Needs a link</span>}
                  {invitesReady && p.status !== "inactive" && (
                    <form action={createInviteLink} className="inline-form">
                      <input type="hidden" name="userId" value={p.id} />
                      <input type="hidden" name="purpose" value={p.passwordSetAt ? "reset" : "invite"} />
                      <button className="linklike">
                        {p.passwordSetAt ? "Reset link" : "Invite link"}
                      </button>
                    </form>
                  )}
                </td>
                <td className="meta">
                  {p.company ?? p.bio ?? "—"}
                  {p.expertise?.length ? ` · ${p.expertise.join(", ")}` : ""}
                </td>
                <td>
                  {p.id !== user.id && (
                    <form action={changeStatus} className="inline-form">
                      <input type="hidden" name="id" value={p.id} />
                      <input type="hidden" name="status" value={p.status === "inactive" ? "active" : "inactive"} />
                      <button className="linklike">{p.status === "inactive" ? "Reactivate" : "Deactivate"}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: "1.25rem" }}>
        <h2>Add someone</h2>
        <p className="meta" style={{ margin: "0 0 .7rem" }}>
          Bringing over a whole cohort? <Link href="/admin/import">Import from a CSV</Link> instead.
        </p>
        <form action={addPerson}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))", gap: ".8rem" }}>
            <div className="formrow"><label htmlFor="name">Name</label>
              <input type="text" id="name" name="name" required /></div>
            <div className="formrow"><label htmlFor="email">Email</label>
              <input type="text" id="email" name="email" required /></div>
            <div className="formrow"><label htmlFor="role">Role</label>
              <select id="role" name="role" defaultValue="founder">
                {ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}
              </select>
            </div>
            <div className="formrow"><label htmlFor="company">Company (founders)</label>
              <input type="text" id="company" name="company" /></div>
            <div className="formrow"><label htmlFor="stage">Stage (founders)</label>
              <input type="text" id="stage" name="stage" placeholder="Idea stage, B2B SaaS" /></div>
            <div className="formrow"><label htmlFor="bio">Background (mentors)</label>
              <input type="text" id="bio" name="bio" placeholder="Founder, 2 exits" /></div>
          </div>
          <div className="formrow"><label htmlFor="expertise">Expertise, comma separated (mentors)</label>
            <input type="text" id="expertise" name="expertise" placeholder="Marketplaces, Pricing, Early GTM" /></div>
          <button className="btn" type="submit">Add person</button>
          <div className="notice">Bulk import from HubSpot is coming; for now this is the way to add people one at a time.</div>
        </form>
      </div>
    </div>
  );
}
