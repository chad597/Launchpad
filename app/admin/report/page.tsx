import Link from "next/link";
import { currentUser } from "@/lib/session";
import { currentTime, getCohort } from "@/lib/data";
import { assembleReport, type FounderWeek } from "@/lib/report";
import { getNarrative } from "@/lib/report-store";
import { geminiConfigured } from "@/lib/gemini";
import { bandLabel, money, weekStartLabel, weekStartOf } from "@/lib/weekly";
import { generateReportNarrative } from "../../actions";
import { PrintButton } from "./print-button";

// The consolidated cohort report: one week of the program on one page,
// readable by someone who was not in the room and printable for someone who
// wants it in their hand.
//
// Every table and number is computed from live data when the page renders.
// The narrative on top is stored per week — written by Gemini when a key is
// configured, composed directly from the facts when not — and regenerating
// it can only change prose, never a number.
export default async function ConsolidatedReport({
  searchParams,
}: {
  searchParams: Promise<{ week?: string; error?: string }>;
}) {
  const user = await currentUser();
  if (user.role !== "admin") {
    return <div className="wrap"><p className="meta">This view is for program admins.</p></div>;
  }
  const { week, error } = await searchParams;

  const now = await currentTime();
  const thisWeek = weekStartOf(now);
  const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(week ?? "") ? week! : thisWeek;

  const cohort = await getCohort();
  const [facts, stored] = await Promise.all([
    assembleReport(cohort, weekStart, now),
    getNarrative(cohort.id, weekStart),
  ]);
  const n = stored?.narrative ?? null;

  const weeks: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(`${thisWeek}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 7 * i);
    weeks.push(d.toISOString().slice(0, 10));
  }

  const num = (v: number | null) => (v == null ? "—" : v.toLocaleString("en-US"));
  const arrow = (d: -1 | 0 | 1 | null) => (d === 1 ? " ↑" : d === -1 ? " ↓" : "");
  const delta = (d: number | null) =>
    d == null || d === 0 ? "" : d > 0 ? ` (+${d})` : ` (${d})`;
  const first = (name: string) => name.split(" ")[0];

  const engagementRow = (f: FounderWeek) => (
    <tr key={f.founder.id}>
      <td>{f.founder.name}<div className="meta">{f.founder.company}</div></td>
      <td>{f.mentor?.name ?? <span className="meta">No mentor assigned</span>}</td>
      <td className="meta">
        {f.metThisWeek
          ? "Met this week"
          : f.nextMeetingAt
            ? `Booked for ${new Date(f.nextMeetingAt).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "America/New_York" })}`
            : f.mentor ? "No meeting, no plan" : "Needs a match first"}
      </td>
    </tr>
  );

  return (
    <div className="wrap">
      <div className="no-print adminnav" aria-label="Weeks">
        {weeks.map((w) => (
          <Link key={w} href={`/admin/report?week=${w}`} className={w === weekStart ? "active" : ""}>
            {w === thisWeek ? "This week" : `Week of ${weekStartLabel(w)}`}
          </Link>
        ))}
      </div>
      {error && <div className="banner bad no-print">{error}</div>}

      <p className="meta" style={{ margin: "0 0 4px" }}>
        Launchpad Tech Ventures · {facts.cohort.ecosystem} · {facts.cohort.name}
      </p>
      <h1 className="page">Consolidated cohort report · week of {weekStartLabel(weekStart)}</h1>
      <p className="sub">
        Week {facts.weekNumber} of 12. Every number on this page is computed from the app&rsquo;s
        records when it loads: attendance from the meetings table, traction from the weekly updates,
        health from the pairs&rsquo; own rhythm. The narrative is written from those numbers and
        stored, so this report reads the same whenever it is opened.
      </p>

      <div className="no-print" style={{ display: "flex", gap: "8px", margin: "0 0 var(--lp-stack)" }}>
        <form action={generateReportNarrative} style={{ display: "inline" }}>
          <input type="hidden" name="weekStart" value={weekStart} />
          <button className="btn">{n ? "Regenerate the narrative" : "Write the narrative"}</button>
        </form>
        <PrintButton />
      </div>
      {!geminiConfigured() && (
        <p className="meta no-print" style={{ margin: "-8px 0 var(--lp-stack)" }}>
          No GEMINI_API_KEY is set, so the narrative is composed directly from the numbers.
          Add a key in Vercel to have Gemini write it.
        </p>
      )}

      <div className="stat-row">
        <div className="stat">
          <div className="n">{facts.filed.length} / {facts.founders.length}</div>
          <div className="l">Filed this week</div>
          <div className="d">{facts.missing.length ? `${facts.missing.length} outstanding` : "Everyone is in"}</div>
        </div>
        <div className="stat">
          <div className="n">{facts.metThisWeek.length}</div>
          <div className="l">Met their mentor</div>
          <div className="d">From the meetings table, not self-report</div>
        </div>
        <div className="stat">
          <div className="n">{facts.noMeetingNoPlan.length}</div>
          <div className="l">No meeting, no plan</div>
          <div className="d">{facts.meetingScheduled.length} more have one booked</div>
        </div>
        <div className="stat">
          <div className="n">{facts.avgConfidence ?? "—"}</div>
          <div className="l">Average confidence</div>
          <div className="d">Out of 10, from those who filed</div>
        </div>
        <div className="stat">
          <div className="n">{money(facts.totals.revenueCents) ?? "—"}</div>
          <div className="l">Collected this week</div>
          <div className="d">{num(facts.totals.payingCount)} paying · {num(facts.totals.usersCount)} using</div>
        </div>
      </div>

      {n ? (
        <>
          <div className="card">
            <h2>Executive summary</h2>
            <p style={{ margin: 0 }}>{n.executiveSummary}</p>
            <p className="meta" style={{ margin: "var(--lp-space-5) 0 0" }}>
              Narrative {stored!.model === "composed" ? "composed from the numbers" : `written by ${stored!.model}`} ·{" "}
              {new Date(stored!.generatedAt).toLocaleString("en-US", {
                month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
              })}
            </p>
          </div>

          <div className="grid two">
            <div className="card">
              <h2>Top wins, ranked</h2>
              {n.wins.length === 0 && <p className="meta" style={{ margin: 0 }}>A quiet week, and reported as one.</p>}
              {n.wins.map((w, i) => (
                <div key={i} style={{ marginBottom: "var(--lp-space-6)" }}>
                  <b style={{ fontSize: ".9rem" }}>{i + 1}. {w.founder}{w.company ? ` — ${w.company}` : ""}</b>
                  <p className="meta" style={{ margin: ".2rem 0 0" }}>{w.what} <i>{w.whyItMatters}</i></p>
                </div>
              ))}
            </div>
            <div className="card">
              <h2>Challenges, clustered</h2>
              {n.challenges.length === 0 && <p className="meta" style={{ margin: 0 }}>No blockers reported this week.</p>}
              {n.challenges.map((c, i) => (
                <div key={i} style={{ marginBottom: "var(--lp-space-6)" }}>
                  <b style={{ fontSize: ".9rem" }}>{c.theme}</b>
                  <span className="meta"> · {c.foundersAffected.join(", ")}</span>
                  <p className="meta" style={{ margin: ".2rem 0 0" }}>{c.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="grid two">
            <div className="card">
              <h2>Watch list</h2>
              {n.watchList.length === 0 && <p className="meta" style={{ margin: 0 }}>Nobody needs a call this week.</p>}
              {n.watchList.map((w, i) => (
                <p key={i} style={{ margin: "0 0 var(--lp-space-4)", fontSize: ".88rem" }}>
                  <b>{w.who}</b> <span className="meta">{w.why}</span>
                </p>
              ))}
            </div>
            <div className="card">
              <h2>What to do this week</h2>
              {n.actions.map((a, i) => (
                <p key={i} style={{ margin: "0 0 var(--lp-space-4)", fontSize: ".88rem" }}>
                  <b>{i + 1}. {a.action}</b> <span className="meta">{a.why}</span>
                </p>
              ))}
            </div>
          </div>
        </>
      ) : (
        <div className="card no-print">
          <h2>No narrative yet for this week</h2>
          <p className="meta" style={{ margin: 0 }}>
            The tables below are live either way. Write the narrative when the week&rsquo;s updates are in —
            usually Monday morning for the week that just ended.
          </p>
        </div>
      )}

      <h2 className="lp-heading" style={{ margin: "var(--lp-stack) 0 12px" }}>The week, founder by founder</h2>
      <div className="tablewrap">
        <table className="board">
          <thead>
            <tr>
              <th>Founder</th><th>Filed</th><th>Hours</th><th>Talked to</th><th>Using it</th>
              <th>Paying</th><th>Collected</th><th>Confidence</th><th>Runway</th>
            </tr>
          </thead>
          <tbody>
            {facts.filed.map((f) => (
              <tr key={f.founder.id}>
                <td>{f.founder.name}<div className="meta">{f.founder.company}</div></td>
                <td className="meta">{f.filedCount} of {facts.weekNumber}</td>
                <td>{bandLabel("hours", f.update!.hours) ?? "—"}{arrow(f.hoursDirection)}</td>
                <td>{bandLabel("conversations", f.update!.conversations) ?? "—"}{arrow(f.conversationsDirection)}</td>
                <td>{num(f.update!.usersCount)}</td>
                <td>{num(f.update!.payingCount)}</td>
                <td>{money(f.update!.revenueCents) ?? "—"}</td>
                <td>{f.update!.confidence ?? "—"}{delta(f.confidenceDelta)}</td>
                <td>{bandLabel("runway", f.update!.runway) ?? "—"}</td>
              </tr>
            ))}
            {facts.missing.map((f) => (
              <tr key={f.founder.id}>
                <td>{f.founder.name}<div className="meta">{f.founder.company}</div></td>
                <td className="meta">{f.filedCount} of {facts.weekNumber}</td>
                <td colSpan={7} className="meta">
                  {f.history.length ? "Nothing filed this week" : "Has never filed"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className="lp-heading" style={{ margin: "var(--lp-stack) 0 12px" }}>Mentor engagement</h2>
      <div className="tablewrap">
        <table className="board">
          <thead><tr><th>Founder</th><th>Mentor</th><th>Status</th></tr></thead>
          <tbody>
            {facts.metThisWeek.map(engagementRow)}
            {facts.meetingScheduled.map(engagementRow)}
            {facts.noMeetingNoPlan.map(engagementRow)}
            {facts.unmatched.map(engagementRow)}
          </tbody>
        </table>
      </div>

      <div className="grid two" style={{ marginTop: "var(--lp-stack)" }}>
        <div className="card">
          <h2>What they asked us for</h2>
          {facts.asks.length === 0 ? (
            <p className="meta" style={{ margin: 0 }}>Nobody asked for anything this week.</p>
          ) : facts.asks.map((a, i) => (
            <div className="flag" key={i}>
              <b style={{ fontSize: ".88rem" }}>{a.founder.name}</b>
              <p className="meta" style={{ margin: ".2rem 0 0" }}>{a.ask}</p>
            </div>
          ))}
        </div>
        <div className="card">
          <h2>In their own words</h2>
          {facts.blockers.length === 0 ? (
            <p className="meta" style={{ margin: 0 }}>No blockers reported.</p>
          ) : facts.blockers.map((b, i) => (
            <p key={i} style={{ margin: "0 0 var(--lp-space-4)", fontSize: ".88rem" }}>
              <b>{first(b.founder.name)}</b>
              {b.confidence != null && <span className="meta"> · confidence {b.confidence}</span>}
              <span className="meta"> — &ldquo;{b.blocker}&rdquo;</span>
            </p>
          ))}
        </div>
      </div>
    </div>
  );
}
