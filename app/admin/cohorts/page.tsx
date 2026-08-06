import { currentUser } from "@/lib/session";
import { listCohorts, listPairings, listUsers, mentorPool } from "@/lib/data";
import { addCohort, changeCohortStatus, saveMentorPool } from "../../actions";

function weekOf(startDate: string) {
  const start = new Date(startDate + "T00:00:00.000Z").getTime();
  return Math.floor((Date.now() - start) / (7 * 24 * 3600 * 1000)) + 1;
}

export default async function CohortsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await currentUser();
  if (user.role !== "admin") {
    return <div className="wrap"><p className="meta">This view is for program admins.</p></div>;
  }
  const { error } = await searchParams;
  const cohorts = await listCohorts();
  const users = await listUsers();
  const mentors = users.filter((u) => u.role === "mentor" && u.status !== "inactive");
  const active = cohorts.find((c) => c.status === "active") ?? cohorts[0];
  const pool = active ? await mentorPool(active.id) : [];
  const pairings = active ? await listPairings(active.id) : [];

  return (
    <div className="wrap">
      <h1 className="page">Cohorts</h1>
      <p className="sub">
        A cohort runs 12 weeks from its start date, and every deadline in the app counts from there. Matching opens in week 3.
      </p>
      {error && <div className="banner bad">{error}</div>}

      <div className="tablewrap">
        <table className="board">
          <thead>
            <tr><th>Cohort</th><th>Ecosystem</th><th>Starts</th><th>Week</th><th>Pairings</th><th>Status</th></tr>
          </thead>
          <tbody>
            {cohorts.map((c) => {
              const w = weekOf(c.startDate);
              return (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.ecosystem}</td>
                  <td className="meta">{c.startDate}</td>
                  <td>{c.status === "active" ? (w > 0 && w <= 12 ? `${w} of 12` : w > 12 ? "Past week 12" : "Not started") : "—"}</td>
                  <td>{c.id === active?.id ? pairings.filter((p) => p.status === "active").length : "—"}</td>
                  <td>
                    <form action={changeCohortStatus} className="inline-form">
                      <input type="hidden" name="id" value={c.id} />
                      <select name="status" defaultValue={c.status} aria-label={`Status for ${c.name}`}>
                        <option value="intake">Intake</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                      </select>
                      <button className="linklike">Save</button>
                    </form>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {active && (
        <div className="card" style={{ marginTop: "1.25rem" }}>
          <h2>1:1 mentor pool · {active.name}</h2>
          <p className="meta" style={{ margin: "0 0 .7rem" }}>
            Most mentors only do Ask-A-Mentor and office hours. Tick the ones who volunteered for 1:1 matching this cohort; matching only draws from this list. {pool.length} of {mentors.length} selected.
          </p>
          <form action={saveMentorPool}>
            <input type="hidden" name="cohortId" value={active.id} />
            <div className="checkgrid">
              {mentors.map((m) => (
                <label key={m.id}>
                  <input type="checkbox" name="mentorId" value={m.id} defaultChecked={pool.includes(m.id)} />
                  <span>{m.name} <span className="meta">{m.bio}</span></span>
                </label>
              ))}
            </div>
            <button className="btn" type="submit" style={{ marginTop: ".8rem" }}>Save pool</button>
          </form>
        </div>
      )}

      <div className="card" style={{ marginTop: "1.25rem" }}>
        <h2>Start a cohort</h2>
        <form action={addCohort}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: ".8rem" }}>
            <div className="formrow"><label htmlFor="name">Name</label>
              <input type="text" id="name" name="name" placeholder="Cohort 8" required /></div>
            <div className="formrow"><label htmlFor="ecosystem">Ecosystem</label>
              <input type="text" id="ecosystem" name="ecosystem" placeholder="Greenville" required /></div>
            <div className="formrow"><label htmlFor="startDate">Start date</label>
              <input type="date" id="startDate" name="startDate" required /></div>
          </div>
          <button className="btn" type="submit">Create cohort</button>
          <div className="notice">New cohorts start in intake. Switch to active when week 1 begins; the week counter and every deadline follow the start date.</div>
        </form>
      </div>
    </div>
  );
}
