import {
  bandDirection, bandLabel, money, weekStartLabel, type WeeklyUpdate,
} from "@/lib/weekly";

const ARROW = { 1: "↑", 0: "·", [-1]: "↓" } as const;

function Delta({ dir }: { dir: -1 | 0 | 1 | null }) {
  if (dir == null) return null;
  return <span className="meta" aria-hidden="true"> {ARROW[dir]}</span>;
}

function num(n: number | null | undefined) {
  return n == null ? "—" : n.toLocaleString("en-US");
}

// The weeks side by side. One row per week, newest first, so a line that is
// going the wrong way is visible without anyone having to build a chart.
// Read by the founder, their mentor, and staff, so it never carries anything
// a founder did not write for all three.
export function WeeklyTrend({ updates, limit = 6 }: { updates: WeeklyUpdate[]; limit?: number }) {
  if (!updates.length) {
    return <p className="meta" style={{ margin: 0 }}>No weekly updates filed yet.</p>;
  }
  const shown = updates.slice(0, limit);

  return (
    <div className="tablewrap" style={{ border: 0 }}>
      <table className="board">
        <thead>
          <tr>
            <th>Week</th><th>Hours</th><th>Talked to</th><th>Using it</th>
            <th>Paying</th><th>Collected</th><th>Confidence</th><th>Runway</th>
          </tr>
        </thead>
        <tbody>
          {shown.map((u, i) => {
            const before = shown[i + 1] ?? null;
            return (
              <tr key={u.id}>
                <td>{weekStartLabel(u.weekStart)}</td>
                <td>
                  {bandLabel("hours", u.hours) ?? "—"}
                  <Delta dir={bandDirection("hours", u.hours, before?.hours ?? null)} />
                </td>
                <td>
                  {bandLabel("conversations", u.conversations) ?? "—"}
                  <Delta dir={bandDirection("conversations", u.conversations, before?.conversations ?? null)} />
                </td>
                <td>{num(u.usersCount)}</td>
                <td>{num(u.payingCount)}</td>
                <td>{money(u.revenueCents) ?? "—"}</td>
                <td>{u.confidence ?? "—"}</td>
                <td>
                  {bandLabel("runway", u.runway) ?? "—"}
                  <Delta dir={bandDirection("runway", u.runway, before?.runway ?? null)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// The most recent week, written out. This is the half a mentor reads before a
// meeting, and the half staff read when deciding who needs a call.
export function LatestWeek({ update, name }: { update: WeeklyUpdate; name?: string }) {
  const who = name ? `${name.split(" ")[0]} ` : "";
  return (
    <>
      <p className="meta" style={{ margin: "0 0 var(--lp-space-5)" }}>
        Week of {weekStartLabel(update.weekStart)}
      </p>
      {update.shipped && (
        <>
          <span className="label">What {who}finished</span>
          <div className="filled">{update.shipped}</div>
        </>
      )}
      {update.blocker && (
        <>
          <span className="label">What is in the way</span>
          <div className="filled">{update.blocker}</div>
        </>
      )}
      {update.ask && (
        <>
          <span className="label">What they asked Launchpad for</span>
          <div className="filled">{update.ask}</div>
        </>
      )}
    </>
  );
}
