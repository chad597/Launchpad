import Link from "next/link";
import { currentUser } from "@/lib/session";
import { cohortMembers, currentTime, getCohort, listUsers } from "@/lib/data";
import { bandLabel, money, weekStartLabel, weekStartOf, weeklyForCohort } from "@/lib/weekly";
import { CONVERSATION_RANK, HOURS_RANK } from "@/lib/weekly-form";

// One week of the cohort on one screen.
//
// The value of the weekly update is not any single answer, it is reading the
// cohort across a week and reading a founder across the twelve. This page is
// the first of those. It leads with who did not file, because a missing
// update is itself the strongest signal the form produces.
export default async function WeeklyRollup({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const user = await currentUser();
  if (user.role !== "admin") {
    return <div className="wrap"><p className="meta">This view is for program admins.</p></div>;
  }
  const { week } = await searchParams;

  const now = await currentTime();
  const thisWeek = weekStartOf(now);
  const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(week ?? "") ? week! : thisWeek;

  const [cohort, users] = await Promise.all([getCohort(), listUsers()]);
  const members = await cohortMembers(cohort.id);
  const updates = await weeklyForCohort(cohort.id, weekStart);

  const byId = new Map(users.map((u) => [u.id, u]));
  const founders = (members.length
    ? members.map((id) => byId.get(id)!).filter(Boolean)
    : users
  ).filter((u) => u.role === "founder" && u.status !== "inactive");

  const filedBy = new Map(updates.map((u) => [u.founderId, u]));
  const filed = founders.filter((f) => filedBy.has(f.id));
  const missing = founders.filter((f) => !filedBy.has(f.id));

  // The four weeks either side, so moving back through the cohort is one
  // click rather than a date field.
  const weeks: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(`${thisWeek}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7 * i);
    weeks.push(d.toISOString().slice(0, 10));
  }

  const rows = [...filed]
    .map((f) => ({ founder: f, u: filedBy.get(f.id)! }))
    .sort((a, b) => (a.u.confidence ?? 99) - (b.u.confidence ?? 99));

  const stalled = rows.filter(
    (r) => (HOURS_RANK[r.u.hours ?? ""] ?? 9) <= 1 || (CONVERSATION_RANK[r.u.conversations ?? ""] ?? 9) === 0
  );
  const confidences = rows.map((r) => r.u.confidence).filter((c): c is number => c != null);
  const avgConfidence = confidences.length
    ? (confidences.reduce((s, c) => s + c, 0) / confidences.length).toFixed(1)
    : "—";
  const asks = rows.filter((r) => r.u.ask);
  const shortRunway = rows.filter((r) => r.u.runway === "under_3");

  const num = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-US"));

  return (
    <div className="wrap">
      <h1 className="page">Weekly updates · week of {weekStartLabel(weekStart)}</h1>
      <p className="sub">
        What the cohort did this week, ordered by how confident each founder is. A founder who did not
        file is at the top of the page rather than absent from it, because that is usually the one to
        call.
      </p>

      <div className="adminnav" aria-label="Weeks">
        {weeks.map((w) => (
          <Link key={w} href={`/admin/weekly?week=${w}`} className={w === weekStart ? "active" : ""}>
            {w === thisWeek ? "This week" : `Week of ${weekStartLabel(w)}`}
          </Link>
        ))}
      </div>

      <div className="stat-row">
        <div className="stat">
          <div className="n">{filed.length} / {founders.length}</div>
          <div className="l">Filed</div>
          <div className="d">{missing.length ? `${missing.length} outstanding` : "Everyone is in"}</div>
        </div>
        <div className="stat">
          <div className="n">{avgConfidence}</div>
          <div className="l">Average confidence</div>
          <div className="d">Out of 10, from those who filed</div>
        </div>
        <div className="stat">
          <div className="n">{stalled.length}</div>
          <div className="l">Barely moved</div>
          <div className="d">Almost no hours, or nobody talked to</div>
        </div>
        <div className="stat">
          <div className="n">{shortRunway.length}</div>
          <div className="l">Under 3 months of runway</div>
          <div className="d">{shortRunway.length ? shortRunway.map((r) => r.founder.name.split(" ")[0]).join(", ") : "Nobody this week"}</div>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="banner bad">
          Nothing filed this week from {missing.map((f) => f.name).join(", ")}.
        </div>
      )}

      <div className="tablewrap">
        <table className="board">
          <thead>
            <tr>
              <th>Founder</th><th>Hours</th><th>Talked to</th><th>Using it</th>
              <th>Paying</th><th>Collected</th><th>Confidence</th><th>Runway</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr><td colSpan={8} className="meta">Nothing filed for this week.</td></tr>
            )}
            {rows.map(({ founder, u }) => (
              <tr key={u.id}>
                <td>{founder.name}<div className="meta">{founder.company}</div></td>
                <td>{bandLabel("hours", u.hours) ?? "—"}</td>
                <td>{bandLabel("conversations", u.conversations) ?? "—"}</td>
                <td>{num(u.usersCount)}</td>
                <td>{num(u.payingCount)}</td>
                <td>{money(u.revenueCents) ?? "—"}</td>
                <td>{u.confidence ?? "—"}</td>
                <td>{bandLabel("runway", u.runway) ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid two" style={{ marginTop: "var(--lp-stack)" }}>
        <div>
          <div className="card">
            <h2>What is in their way</h2>
            <p className="meta" style={{ margin: "0 0 var(--lp-space-5)" }}>
              In their own words, in the same order as the table.
            </p>
            {rows.length === 0 && <p className="meta" style={{ margin: 0 }}>Nothing filed yet.</p>}
            {rows.map(({ founder, u }) => (
              <div key={u.id} style={{ marginBottom: "var(--lp-space-6)" }}>
                <span className="label">
                  {founder.name}
                  {u.confidence != null ? ` · confidence ${u.confidence}` : ""}
                </span>
                {u.blocker && <div className="filled">{u.blocker}</div>}
                {u.shipped && (
                  <p className="meta" style={{ margin: ".3rem 0 0" }}>Finished: {u.shipped}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="card">
            <h2>What they asked us for</h2>
            <p className="meta" style={{ margin: "0 0 var(--lp-space-5)" }}>
              The one thing each founder said would help this week. This is the list worth working
              through on a Monday.
            </p>
            {asks.length === 0 ? (
              <p className="meta" style={{ margin: 0 }}>Nobody asked for anything this week.</p>
            ) : asks.map(({ founder, u }) => (
              <div className="flag" key={u.id}>
                <b style={{ fontSize: ".88rem" }}>{founder.name}</b>
                <p className="meta" style={{ margin: ".2rem 0 0" }}>{u.ask}</p>
              </div>
            ))}
          </div>

          <div className="card">
            <h2>Who has stopped moving</h2>
            {stalled.length === 0 ? (
              <p className="meta" style={{ margin: 0 }}>Everyone who filed put hours in and talked to somebody.</p>
            ) : (
              <ul className="bare">
                {stalled.map(({ founder, u }) => (
                  <li key={u.id} style={{ fontSize: ".87rem", marginBottom: ".4rem" }}>
                    <b>{founder.name}</b>{" "}
                    <span className="meta">
                      {bandLabel("hours", u.hours)?.toLowerCase()}, talked to {(bandLabel("conversations", u.conversations) ?? "nobody").toLowerCase()}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
