import Link from "next/link";
import { currentUser } from "@/lib/session";
import { getCohort, listPairings, listUsers, mentorPool } from "@/lib/data";
import { addPairing, changePairing } from "../../actions";
import { AdminNav } from "../nav";

const STATUSES = ["proposed", "active", "paused", "completed", "dissolved"] as const;
const CADENCES = ["weekly", "biweekly", "monthly", "as_needed"] as const;
const CADENCE_LABEL = {
  weekly: "Weekly", biweekly: "Biweekly", monthly: "Monthly", as_needed: "As needed",
} as const;
const STATUS_PILL = {
  active: "good", proposed: "info", paused: "warn", completed: "info", dissolved: "crit",
} as const;

export default async function PairingsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const user = await currentUser();
  if (user.role !== "admin") {
    return <div className="wrap"><p className="meta">This view is for program admins.</p></div>;
  }
  const { error } = await searchParams;
  const cohort = await getCohort();
  const [pairings, users, pool] = await Promise.all([
    listPairings(cohort.id), listUsers(), mentorPool(cohort.id),
  ]);
  const byId = new Map(users.map((u) => [u.id, u]));
  const founders = users.filter((u) => u.role === "founder" && u.status !== "inactive");
  const poolMentors = users.filter((u) => pool.includes(u.id) && u.status !== "inactive");
  const activePairs = pairings.filter((p) => p.status === "active");
  const unmatched = founders.filter((f) => !activePairs.some((p) => p.founderId === f.id));
  const load = new Map<string, number>();
  for (const p of activePairs) load.set(p.mentorId, (load.get(p.mentorId) ?? 0) + 1);

  return (
    <div className="wrap">
      <AdminNav current="/admin/pairings" />
      <h1 className="page">Pairings · {cohort.name}</h1>
      <p className="sub">
        Every pairing in this cohort, including ended ones. Dissolving a pairing keeps its whole history; it does not delete the record.
      </p>
      {error && <div className="banner bad">{error}</div>}
      {unmatched.length > 0 && (
        <div className="banner bad">
          {unmatched.length} founder{unmatched.length === 1 ? "" : "s"} without an active mentor: {unmatched.map((f) => f.name).join(", ")}
        </div>
      )}

      <div className="tablewrap">
        <table className="board">
          <thead>
            <tr><th>Founder</th><th>Mentor</th><th>Cadence</th><th>Status</th><th></th><th></th></tr>
          </thead>
          <tbody>
            {pairings.map((p) => (
              <tr key={p.id} style={p.status === "dissolved" ? { opacity: 0.55 } : undefined}>
                <td>{byId.get(p.founderId)?.name ?? "—"}</td>
                <td>{byId.get(p.mentorId)?.name ?? "—"}</td>
                <td>
                  <form action={changePairing} className="inline-form">
                    <input type="hidden" name="id" value={p.id} />
                    <select name="cadence" defaultValue={p.declaredCadence} aria-label="Cadence">
                      {CADENCES.map((c) => <option key={c} value={c}>{CADENCE_LABEL[c]}</option>)}
                    </select>
                    <button className="linklike">Save</button>
                  </form>
                </td>
                <td><span className={`pill ${STATUS_PILL[p.status]}`}>{p.status}</span></td>
                <td>
                  <form action={changePairing} className="inline-form">
                    <input type="hidden" name="id" value={p.id} />
                    <select name="status" defaultValue={p.status} aria-label="Status">
                      {STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <button className="linklike">Save</button>
                  </form>
                </td>
                <td>
                  {p.status === "active" && (
                    <Link className="linklike" href={`/messages/${p.id}`}>Conversation</Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: "1.25rem" }}>
        <h2>Pair manually</h2>
        <p className="meta" style={{ margin: "0 0 .7rem" }}>
          For matches you make outside the shortlist, or a second mentor for a founder who needs one.
        </p>
        <form action={addPairing}>
          <input type="hidden" name="cohortId" value={cohort.id} />
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: ".8rem" }}>
            <div className="formrow"><label htmlFor="founderId">Founder</label>
              <select id="founderId" name="founderId" required defaultValue="">
                <option value="" disabled>Choose a founder</option>
                {founders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}{activePairs.some((p) => p.founderId === f.id) ? " (already paired)" : ""}
                  </option>
                ))}
              </select>
            </div>
            <div className="formrow"><label htmlFor="mentorId">Mentor</label>
              <select id="mentorId" name="mentorId" required defaultValue="">
                <option value="" disabled>Choose a mentor</option>
                {poolMentors.map((m) => {
                  const n = load.get(m.id) ?? 0;
                  const cap = m.capacity ?? 1;
                  return (
                    <option key={m.id} value={m.id}>
                      {m.name} ({n} of {cap}){n >= cap ? " at capacity" : ""}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="formrow"><label htmlFor="cadence">Cadence</label>
              <select id="cadence" name="cadence" defaultValue="biweekly">
                {CADENCES.map((c) => <option key={c} value={c}>{CADENCE_LABEL[c]}</option>)}
              </select>
            </div>
          </div>
          <div className="formrow"><label htmlFor="rationale">Why these two? (both of them will read this)</label>
            <textarea id="rationale" name="rationale" placeholder="What in this mentor's background lines up with what this founder is working on right now." />
          </div>
          <button className="btn" type="submit">Create pairing</button>
          {poolMentors.length === 0 && (
            <div className="notice">No mentors are in this cohort&rsquo;s 1:1 pool yet. Add them on the Cohorts page first.</div>
          )}
        </form>
      </div>
    </div>
  );
}
