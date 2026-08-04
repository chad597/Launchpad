import Link from "next/link";
import { currentUser } from "@/lib/session";
import {
  cohortHealthBoard, getCohort, getUser, openFlags, suggestionsForFounder, weekNumber,
} from "@/lib/data";
import { closeFlag, selectMatch } from "../actions";
import type { User } from "@/lib/types";

const HEALTH_PILL = { healthy: "good", watch: "warn", attention: "crit" } as const;
const HEALTH_LABEL = { healthy: "Healthy", watch: "Watch", attention: "Attention" } as const;

function fmtDay(dt: string) {
  return new Date(dt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "America/New_York" });
}

export default async function AdminHome() {
  const user = await currentUser();
  if (user.role !== "admin") {
    return <div className="wrap"><p className="meta">This view is for program staff.</p></div>;
  }
  const [cohort, board, flags, week] = await Promise.all([
    getCohort(), cohortHealthBoard(), openFlags(), weekNumber(),
  ]);
  const needsAttention = board.filter((b) => b.health !== "healthy");
  let done = 0, expected = 0;
  for (const b of board) { done += b.notesComplete; expected += b.notesExpected; }
  const noteCompliance = expected ? Math.round((100 * done) / expected) : 100;

  const rematch = board.find((b) => b.health === "attention");
  const suggestions = rematch ? await suggestionsForFounder(rematch.founder.id) : [];
  const suggestionMentors = new Map<string, User>();
  for (const s of suggestions) {
    const m = await getUser(s.mentorId);
    if (m) suggestionMentors.set(s.mentorId, m);
  }
  const flagRaisers = new Map<string, User>();
  for (const f of flags) {
    const u = await getUser(f.raisedById);
    if (u) flagRaisers.set(f.raisedById, u);
  }

  return (
    <div className="wrap">
      <h1 className="page">{cohort.ecosystem} · {cohort.name}</h1>
      <p className="sub">
        Week {week} of 12 · {board.length} active pairings · started {fmtDay(cohort.startDate + "T12:00:00Z")}. Open a pair to read their notes and conversation.
      </p>

      <div className="stat-row">
        <div className="stat"><div className="n">{board.length}</div><div className="l">Active pairings</div><div className="d" style={{ color: "var(--good)" }}>All matched in week 3</div></div>
        <div className="stat"><div className="n">{noteCompliance}%</div><div className="l">Note compliance</div><div className="d" style={{ color: noteCompliance >= 90 ? "var(--good)" : "var(--warn)" }}>{noteCompliance >= 90 ? "On pace" : "Chasing stragglers"}</div></div>
        <div className="stat"><div className="n">{needsAttention.length}</div><div className="l">Pairs need attention</div><div className="d" style={{ color: needsAttention.length ? "var(--crit)" : "var(--good)" }}>{needsAttention.filter((b) => b.health === "attention").length} red · {needsAttention.filter((b) => b.health === "watch").length} yellow</div></div>
        <div className="stat"><div className="n">{flags.length}</div><div className="l">Open flags</div><div className="d" style={{ color: flags.length ? "var(--warn)" : "var(--good)" }}>{flags.length ? "Review below" : "None open"}</div></div>
      </div>

      <div className="tablewrap">
        <table className="board">
          <thead>
            <tr><th></th><th>Pair</th><th>Health</th><th>Last met</th><th>Next meeting</th><th>Notes</th><th>Signal</th></tr>
          </thead>
          <tbody>
            {board.map((b) => (
              <tr key={b.pairing.id}>
                <td className={`stripe ${b.health}`}></td>
                <td>
                  <Link href={`/admin/pairings/${b.pairing.id}`}>
                    {b.founder.name.split(" ").pop()} · {b.mentor.name.split(" ").pop()}
                  </Link>
                </td>
                <td><span className={`pill ${HEALTH_PILL[b.health]}`}>{HEALTH_LABEL[b.health]}</span></td>
                <td>{b.lastMetDaysAgo != null ? `${b.lastMetDaysAgo} days ago` : "Never"}</td>
                <td>{b.nextMeeting ? fmtDay(b.nextMeeting.scheduledAt) : "None booked"}</td>
                <td>{b.notesComplete} / {b.notesExpected}</td>
                <td className="meta">{b.signal}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid two" style={{ marginTop: "1.25rem" }}>
        <div className="card">
          <h2>{rematch ? `Matching · ${rematch.founder.name} (rematch)` : "Matching"}</h2>
          {user.role !== "admin" ? (
            <p className="meta">Matching is run by the program admin.</p>
          ) : rematch && suggestions.length ? (
            <>
              <p className="meta" style={{ margin: "0 0 .5rem" }}>Pool: volunteer mentors with open capacity</p>
              {suggestions.map((s, i) => {
                const m = suggestionMentors.get(s.mentorId);
                return (
                  <div className={`shortlist${i === 0 ? " top" : ""}`} key={s.id}>
                    <div className="head"><b>{m?.name ?? "…"}</b><span className="meta">{m?.bio}</span><span className="score">{s.score}</span></div>
                    <div>{s.breakdown.map((c) => <span className="chip" key={c}>{c}</span>)}</div>
                    <p className="rationale">{s.rationale}</p>
                    {i === 0 && (
                      <form action={selectMatch} style={{ display: "inline" }}>
                        <input type="hidden" name="suggestionId" value={s.id} />
                        <input type="hidden" name="founderId" value={s.founderId} />
                        <button className="btn">Confirm match and send the intro</button>
                      </form>
                    )}
                  </div>
                );
              })}
            </>
          ) : (
            <p className="meta" style={{ margin: 0 }}>No matching runs pending. The next cohort&rsquo;s window opens at week 3.</p>
          )}
        </div>
        <div className="card">
          <h2>Flags</h2>
          {flags.length ? flags.map((f) => (
            <div className="flag" key={f.id}>
              <b style={{ fontSize: ".88rem" }}>
                {f.category === "pattern_risk" ? "Pattern risk" : f.category === "match_not_working" ? "Match not working" : "Flag"} · {flagRaisers.get(f.raisedById)?.name ?? "Unknown"}
              </b>
              <p className="meta" style={{ margin: ".2rem 0" }}>&ldquo;{f.body}&rdquo;</p>
              <span className="pill warn">Open</span>{" "}
              {user.role === "admin" && (
                <form action={closeFlag} style={{ display: "inline" }}>
                  <input type="hidden" name="id" value={f.id} />
                  <button className="linklike">Resolve</button>
                </form>
              )}
            </div>
          )) : <p className="meta" style={{ margin: 0 }}>No open flags.</p>}
          <hr className="divider" />
          <h2>Coming up</h2>
          <ul style={{ margin: ".2rem 0 0 1.1rem", padding: 0, fontSize: ".85rem" }}>
            <li><b>Week 6:</b> match-quality pulse goes to all participants</li>
            <li><b>Week 11:</b> continuation ask goes to mentors first</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
