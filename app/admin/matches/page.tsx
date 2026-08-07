import Link from "next/link";
import { currentUser } from "@/lib/session";
import {
  cohortMembers, getCohort, listCohorts, listPairings, listUsers, mentorPool, openFlags,
  suggestionsForFounder,
} from "@/lib/data";
import { closeFlag, selectMatch, suggestMatches } from "../../actions";
import {
  BACKGROUND_LABELS, MENTOR_STAGE_LABELS, commitmentLabel, formatLabel, industryLabel,
  industryPrefLabel, scoreBand, scorePair, skillLabel,
  stageLabel, teamLabel, timeZoneLabel, totalBand, type MatchScore,
} from "@/lib/match";
import type { Cohort, Flag, Pairing, User } from "@/lib/types";

const YEARS_LABELS: Record<string, string> = {
  under_5: "Under 5 years", "5_10": "5 to 10 years", "10_20": "10 to 20 years", "20_plus": "20+ years",
};

// A definition list cell. Anything unanswered says so rather than rendering
// blank, because on this page the difference between "no" and "never asked"
// is the whole point.
function Fact({ term, children }: { term: string; children?: React.ReactNode }) {
  const empty = children == null || children === "" || (Array.isArray(children) && !children.length);
  return (
    <div>
      <dt>{term}</dt>
      <dd className={empty ? "empty" : undefined}>{empty ? "Not answered" : children}</dd>
    </div>
  );
}

const listOf = (values: string[] | undefined, label: (v: string) => string) =>
  values?.length ? values.map(label).join(", ") : undefined;

const rankedOf = (values: string[] | undefined, label: (v: string) => string) =>
  values?.length ? values.map((v, i) => `${i + 1}. ${label(v)}`).join("  ·  ") : undefined;

function ExternalLink({ href, children }: { href?: string; children: React.ReactNode }) {
  if (!href) return null;
  const url = href.startsWith("http") ? href : `https://${href}`;
  return (
    <a className="linklike" href={url} target="_blank" rel="noreferrer noopener">
      {children} ↗
    </a>
  );
}

function ScoreChips({ score }: { score: MatchScore }) {
  return (
    <div className="scorechips">
      {score.criteria.map((c) => (
        <span key={c.key} className={`scorechip ${scoreBand(c.score)}`} title={c.note}>
          {c.label} <span className="v">{c.score == null ? "—" : c.score}</span>
        </span>
      ))}
    </div>
  );
}

function FounderFacts({ f }: { f: User }) {
  return (
    <>
      <dl className="facts">
        <Fact term="Company">{f.company}</Fact>
        <Fact term="Where they are">{f.founderStage && stageLabel(f.founderStage)}</Fact>
        <Fact term="Industry">{listOf(f.industries, industryLabel)}</Fact>
        <Fact term="Who is working on it">{f.teamShape && teamLabel(f.teamShape)}</Fact>
        <Fact term="Time they give it">{f.timeCommitment && commitmentLabel(f.timeCommitment)}</Fact>
        <Fact term="Time zone">{f.timeZone && timeZoneLabel(f.timeZone)}</Fact>
        <Fact term="Usually free">{f.availability}</Fact>
        <Fact term="Wants a mentor who is">{f.mentoringFormat && formatLabel(f.mentoringFormat)}</Fact>
        <Fact term="Industry match matters">{f.industryPref && industryPrefLabel(f.industryPref)}</Fact>
        <Fact term="Email">{f.email}</Fact>
      </dl>
      <dl className="facts wide" style={{ marginTop: "var(--lp-space-6)" }}>
        <Fact term="What they need, ranked">{rankedOf(f.needs, skillLabel)}</Fact>
        <Fact term="Already covered">{listOf(f.strengths, skillLabel)}</Fact>
        <Fact term="In one sentence">{f.bio}</Fact>
        <Fact term="Hardest thing in front of them">{f.challenge}</Fact>
        <Fact term="What would make twelve weeks worth it">{f.goal}</Fact>
      </dl>
    </>
  );
}

function MentorFacts({ m, load }: { m: User; load: number }) {
  return (
    <>
      <dl className="facts">
        <Fact term="Title">{[m.title, m.company].filter(Boolean).join(", ") || undefined}</Fact>
        <Fact term="Years in it">{m.yearsExperience && YEARS_LABELS[m.yearsExperience]}</Fact>
        <Fact term="Background">{listOf(m.background, (v) => BACKGROUND_LABELS[v] ?? v)}</Fact>
        <Fact term="Industries">{listOf(m.industries, industryLabel)}</Fact>
        <Fact term="Most useful at">{m.stagePreference && MENTOR_STAGE_LABELS[m.stagePreference]}</Fact>
        <Fact term="How they work">{m.mentoringFormat && formatLabel(m.mentoringFormat)}</Fact>
        <Fact term="Time zone">{m.timeZone && timeZoneLabel(m.timeZone)}</Fact>
        <Fact term="Usually free">{m.availability}</Fact>
        <Fact term="Founders carried">{`${load} of ${m.capacity ?? 1}`}</Fact>
        <Fact term="Email">{m.email}</Fact>
      </dl>
      <dl className="facts wide" style={{ marginTop: "var(--lp-space-6)" }}>
        <Fact term="What they can help with, ranked">{rankedOf(m.skills, skillLabel)}</Fact>
        <Fact term="Would rather not be the go-to for">
          {m.avoidSkills === undefined ? undefined : m.avoidSkills.length ? listOf(m.avoidSkills, skillLabel) : "Nothing"}
        </Fact>
        <Fact term="In one line">{m.bio}</Fact>
        <Fact term="A problem they have solved">{m.story}</Fact>
        <Fact term="Told us before matching">{m.conflicts}</Fact>
      </dl>
    </>
  );
}

interface Row {
  pairing: Pairing;
  founder: User;
  mentor: User;
  cohort: Cohort;
  score: MatchScore;
  load: number;
  flags: Flag[];
}

// Every pairing in one place, with the answers that produced it. The point of
// this page is that no pairing has to be taken on trust: the score is only a
// way of ordering the rows, and the sentences under it are the actual report.
export default async function MatchReport({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; cohort?: string; only?: string; suggest?: string }>;
}) {
  const user = await currentUser();
  if (user.role !== "admin") {
    return <div className="wrap"><p className="meta">This view is for program admins.</p></div>;
  }
  const { q = "", cohort: cohortParam, only, suggest } = await searchParams;

  const [cohorts, users, flags, active] = await Promise.all([
    listCohorts(), listUsers(), openFlags(), getCohort(),
  ]);
  const scope = cohortParam && cohortParam !== "all"
    ? cohorts.filter((c) => c.id === cohortParam)
    : cohorts.length ? cohorts : [active];
  const byId = new Map(users.map((u) => [u.id, u]));

  const pairingsByCohort = await Promise.all(scope.map((c) => listPairings(c.id)));
  const memberships = await Promise.all(scope.map((c) => cohortMembers(c.id)));
  const pools = await Promise.all(scope.map((c) => mentorPool(c.id)));

  // Load counts every active pairing a mentor holds, across cohorts, because
  // capacity is a person's limit and not a cohort's.
  const allActive = await Promise.all(cohorts.map((c) => listPairings(c.id)));
  const load = new Map<string, number>();
  for (const p of allActive.flat()) {
    if (p.status === "active") load.set(p.mentorId, (load.get(p.mentorId) ?? 0) + 1);
  }

  const rows: Row[] = [];
  scope.forEach((c, i) => {
    for (const p of pairingsByCohort[i]) {
      if (p.status === "dissolved") continue;
      const founder = byId.get(p.founderId), mentor = byId.get(p.mentorId);
      if (!founder || !mentor) continue;
      const mentorLoad = load.get(p.mentorId) ?? 1;
      rows.push({
        pairing: p, founder, mentor, cohort: c, load: mentorLoad,
        score: scorePair(founder, mentor, { mentorLoad }),
        flags: flags.filter((f) => f.pairingId === p.id),
      });
    }
  });

  const needle = q.trim().toLowerCase();
  const matchesSearch = (r: Row) =>
    !needle ||
    [r.founder.name, r.mentor.name, r.founder.company, r.cohort.name]
      .some((s) => s?.toLowerCase().includes(needle));
  const needsLook = (r: Row) => r.score.warnings.length > 0 || r.flags.length > 0;

  let shown = rows.filter(matchesSearch);
  if (only === "flagged") shown = shown.filter(needsLook);
  shown.sort((a, b) => (b.score.total ?? -1) - (a.score.total ?? -1));

  // A founder in a scoped cohort with nobody actively assigned.
  const pairedFounderIds = new Set(rows.filter((r) => r.pairing.status === "active").map((r) => r.founder.id));
  const scopedFounders = new Set<string>();
  scope.forEach((c, i) => {
    const members = memberships[i];
    const founders = members.length
      ? members.filter((id) => byId.get(id)?.role === "founder")
      : users.filter((u) => u.role === "founder" && u.status !== "inactive").map((u) => u.id);
    for (const id of founders) scopedFounders.add(id);
  });
  const unmatched = [...scopedFounders]
    .map((id) => byId.get(id)!)
    .filter((f) => f && f.status !== "inactive" && !pairedFounderIds.has(f.id))
    .filter((f) => !needle || f.name.toLowerCase().includes(needle) || f.company?.toLowerCase().includes(needle));

  // A matcher run for one unmatched founder: the persisted shortlist, plus
  // the mentors the hard filter kept out, recomputed so the page can say who
  // is missing and why rather than leave them silently absent.
  const poolAll = new Set(pools.flat());
  const suggestFounder = suggest ? byId.get(suggest) : undefined;
  const shortlist = suggestFounder ? await suggestionsForFounder(suggestFounder.id) : [];
  const topNeed = suggestFounder?.needs?.[0];
  const excludedMentors = topNeed
    ? users.filter((u) =>
        u.role === "mentor" && u.status !== "inactive" &&
        (poolAll.size === 0 || poolAll.has(u.id)) && u.avoidSkills?.includes(topNeed))
    : [];

  const poolSize = poolAll.size;
  const scoredRows = shown.filter((r) => r.score.total != null);
  const average = scoredRows.length
    ? Math.round(scoredRows.reduce((s, r) => s + (r.score.total as number), 0) / scoredRows.length)
    : null;
  const flaggedCount = rows.filter(needsLook).length;
  const changeRequests = flags.filter((f) => f.category === "match_not_working");

  const listing = only === "unmatched" ? [] : shown;

  return (
    <div className="wrap">
      <h1 className="page">Match report</h1>
      <p className="sub">
        Every pairing, with the answers behind it. The score orders the list; the sentences under each
        row are the reason. A criterion neither side answered is left out of the score rather than
        counted against the pair, so a low score on a thin profile means we do not know yet.
      </p>

      <div className="stat-row">
        <div className="stat">
          <div className="n">{rows.length}</div>
          <div className="l">Pairings</div>
          <div className="d">{scope.length === 1 ? scope[0].name : `${scope.length} cohorts`}</div>
        </div>
        <div className="stat">
          <div className="n">{average ?? "—"}</div>
          <div className="l">Average score</div>
          <div className="d">{scoredRows.length} of {shown.length} could be scored</div>
        </div>
        <div className="stat">
          <div className="n">{flaggedCount}</div>
          <div className="l">Worth a look</div>
          <div className="d">{flaggedCount ? "A conflict, a flag, or a mentor over capacity" : "Nothing outstanding"}</div>
        </div>
        <div className="stat">
          <div className="n">{unmatched.length}</div>
          <div className="l">Founders unmatched</div>
          <div className="d">{poolSize} mentors in the 1:1 pool</div>
        </div>
      </div>

      <form className="card" method="get" style={{ padding: "var(--lp-card-pad-tight)" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--lp-space-5)", alignItems: "flex-end" }}>
          <div className="formrow" style={{ flex: "2 1 260px", margin: 0 }}>
            <label htmlFor="q">Search</label>
            <input id="q" name="q" defaultValue={q} placeholder="Name, company, or cohort" style={{ width: "100%" }} />
          </div>
          <div className="formrow" style={{ flex: "1 1 180px", margin: 0 }}>
            <label htmlFor="cohort">Cohort</label>
            <select id="cohort" name="cohort" defaultValue={cohortParam ?? "all"}>
              <option value="all">All cohorts</option>
              {cohorts.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="formrow" style={{ flex: "1 1 180px", margin: 0 }}>
            <label htmlFor="only">Show</label>
            <select id="only" name="only" defaultValue={only ?? ""}>
              <option value="">Every pairing</option>
              <option value="flagged">Only those worth a look</option>
              <option value="unmatched">Only unmatched founders</option>
            </select>
          </div>
          <button className="btn ghost" type="submit">Apply</button>
          {(q || cohortParam || only) && (
            <Link className="linklike" href="/admin/matches">Clear</Link>
          )}
        </div>
      </form>

      <div className="card" style={{ padding: 0, overflow: "hidden", marginTop: "var(--lp-stack)" }}>
        {listing.length === 0 && (
          <p className="meta" style={{ margin: 0, padding: "var(--lp-card-pad-tight)" }}>
            {only === "unmatched" ? "Unmatched founders are listed below." : "No pairings match that."}
          </p>
        )}
        {listing.map((r) => {
          const band = totalBand(r.score.total);
          return (
            <details className={`matchrow${needsLook(r) ? " needs-look" : ""}`} key={r.pairing.id}>
              <summary>
                <div className="who-cell">
                  <b>{r.mentor.name}</b>
                  <div className="meta">
                    {r.founder.name}{r.founder.company ? ` · ${r.founder.company}` : ""}
                  </div>
                </div>
                <div className="col" style={{ flexBasis: "150px" }}>
                  <div className="col-label">Cohort</div>
                  <div className="lp-small">{r.cohort.name}</div>
                </div>
                <div className="col" style={{ flexBasis: "70px" }}>
                  <div className="col-label">Score</div>
                  <div className={`total ${band}`}>{r.score.total ?? "—"}</div>
                </div>
                <div className="col" style={{ flexBasis: "110px" }}>
                  <div className="col-label">Based on</div>
                  <div className="lp-small">{r.score.scored} of {r.score.of}</div>
                </div>
                <div className="col" style={{ flexBasis: "160px" }}>
                  {r.pairing.status !== "active" && <span className="pill info">{r.pairing.status}</span>}{" "}
                  {r.score.warnings.length > 0 && (
                    <span className="pill crit">{r.score.warnings.length} to check</span>
                  )}{" "}
                  {r.flags.length > 0 && <span className="pill warn">{r.flags.length} flag</span>}
                </div>
              </summary>

              <div className="body">
                <ScoreChips score={r.score} />

                {r.score.warnings.length > 0 && (
                  <div className="banner bad" style={{ marginBottom: "var(--lp-space-6)" }}>
                    {r.score.warnings.map((w) => <div key={w}>{w}</div>)}
                  </div>
                )}

                <div className="grid two">
                  <div>
                    <div className="card">
                      <h2>How this scores</h2>
                      <ul className="reasons">
                        {r.score.criteria.map((c) => (
                          <li key={c.key}>
                            <span className="rname">{c.label}</span>
                            <span className="rval">{c.score == null ? "—" : c.score}</span>
                            <span>{c.note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="card">
                      <h2>{r.founder.name}</h2>
                      <p className="meta" style={{ margin: "0 0 var(--lp-space-5)" }}>
                        Founder{" "}
                        <ExternalLink href={r.founder.website}>Website</ExternalLink>{" "}
                        <ExternalLink href={r.founder.linkedin}>LinkedIn</ExternalLink>
                      </p>
                      <FounderFacts f={r.founder} />
                    </div>

                    <div className="card">
                      <h2>{r.mentor.name}</h2>
                      <p className="meta" style={{ margin: "0 0 var(--lp-space-5)" }}>
                        Mentor <ExternalLink href={r.mentor.linkedin}>LinkedIn</ExternalLink>
                      </p>
                      <MentorFacts m={r.mentor} load={r.load} />
                    </div>
                  </div>

                  <div>
                    <div className="card">
                      <h2>Why these two</h2>
                      <p style={{ fontSize: "var(--lp-size-body)", margin: 0 }}>
                        {r.pairing.matchRationale || "Nobody wrote a reason when this pairing was made. Both of them read this, so it is worth adding one."}
                      </p>
                      <hr className="divider" />
                      <p className="meta" style={{ margin: 0 }}>
                        Meeting cadence they declared: {r.pairing.declaredCadence.replace("_", " ")}.
                      </p>
                    </div>

                    {r.flags.length > 0 && (
                      <div className="card">
                        <h2>Flags on this pair</h2>
                        {r.flags.map((f) => (
                          <div className="flag" key={f.id}>
                            <b style={{ fontSize: ".88rem" }}>
                              {f.category.replace(/_/g, " ")} · {byId.get(f.raisedById)?.name ?? "Someone"}
                            </b>
                            <p className="meta" style={{ margin: ".2rem 0 0" }}>&ldquo;{f.body}&rdquo;</p>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="card">
                      <h2>Open this pair</h2>
                      <p className="meta" style={{ margin: "0 0 var(--lp-space-5)" }}>
                        The full record has their meetings, notes, and conversation. Opening it is recorded.
                      </p>
                      <Link className="btn ghost" href={`/admin/pairings/${r.pairing.id}`}>Pairing record</Link>
                    </div>
                  </div>
                </div>
              </div>
            </details>
          );
        })}
      </div>

      <h2 className="lp-heading" style={{ margin: "var(--lp-stack) 0 12px" }}>Founders without a mentor</h2>

      {suggestFounder && pairedFounderIds.has(suggestFounder.id) && (
        <div className="banner ok" style={{ marginBottom: "12px" }}>
          {suggestFounder.name} is matched. The intro is on its way to both people.
        </div>
      )}
      {suggestFounder && !pairedFounderIds.has(suggestFounder.id) && (
        <div className="card" style={{ marginBottom: "12px" }}>
          <h2>Shortlist for {suggestFounder.name}</h2>
          <p className="meta" style={{ margin: "0 0 var(--lp-space-5)" }}>
            {shortlist.length
              ? `The best ${shortlist.length === 1 ? "candidate" : `${shortlist.length} candidates`} from the 1:1 pool, best first. Confirming sends the intro to both people, with the rationale below in it.`
              : "The matcher found nobody to suggest. Check that the cohort has a 1:1 pool and that the intake forms are filled in."}
          </p>
          {shortlist.map((s, i) => {
            const m = byId.get(s.mentorId);
            return (
              <div className={`shortlist${i === 0 ? " top" : ""}`} key={s.id}>
                <div className="head">
                  <b>{m?.name ?? "…"}</b>
                  <span className="meta">{[m?.title, m?.company].filter(Boolean).join(", ")}</span>
                  <span className="score">{s.score}</span>
                </div>
                <div>{s.breakdown.map((c) => <span className="chip" key={c}>{c}</span>)}</div>
                <p className="rationale">{s.rationale}</p>
                <form action={selectMatch} style={{ display: "inline" }}>
                  <input type="hidden" name="suggestionId" value={s.id} />
                  <button className={i === 0 ? "btn" : "btn ghost"}>Confirm match and send the intro</button>
                </form>
              </div>
            );
          })}
          {excludedMentors.length > 0 && topNeed && (
            <p className="meta" style={{ margin: "var(--lp-space-5) 0 0" }}>
              Left out: {excludedMentors.map((m) => m.name).join(", ")} — would rather not be the
              go-to for {skillLabel(topNeed).toLowerCase()}, which is {suggestFounder.name.split(" ")[0]}&rsquo;s number 1.
            </p>
          )}
        </div>
      )}

      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        {unmatched.length === 0 && (
          <p className="meta" style={{ margin: 0, padding: "var(--lp-card-pad-tight)" }}>
            Every founder in scope has a mentor.
          </p>
        )}
        {unmatched.map((f, i) => (
          <div className="lp-row" key={f.id} style={i === unmatched.length - 1 ? { borderBottom: 0 } : undefined}>
            <div className="lp-row-main">
              <b style={{ fontSize: "var(--lp-size-body)" }}>{f.name}</b>
              <div className="meta">
                {f.company ?? "No company recorded"}
                {f.needs?.length ? ` · needs ${skillLabel(f.needs[0]).toLowerCase()}` : " · intake not filled in"}
              </div>
            </div>
            <div className="lp-row-col" style={{ flexBasis: "180px" }}>
              <div className="lp-row-label">Where they are</div>
              <div className="lp-small">{f.founderStage ? stageLabel(f.founderStage) : "Unknown"}</div>
            </div>
            <div className="lp-row-col">
              <form action={suggestMatches} style={{ display: "inline" }}>
                <input type="hidden" name="founderId" value={f.id} />
                <button className="linklike">Find a mentor</button>
              </form>
              {" · "}
              <Link className="linklike" href="/admin/pairings">Pair by hand</Link>
            </div>
          </div>
        ))}
      </div>

      <h2 className="lp-heading" style={{ margin: "var(--lp-stack) 0 12px" }}>Match change requests</h2>
      <div className="card">
        <p className="meta" style={{ margin: "0 0 var(--lp-space-5)" }}>
          Raised by a mentor or a founder who told us the match is not working.
        </p>
        {changeRequests.length === 0 ? (
          <p className="meta" style={{ margin: 0 }}>Nobody has asked to change a match.</p>
        ) : changeRequests.map((f) => {
          const pair = rows.find((r) => r.pairing.id === f.pairingId);
          return (
            <div className="flag" key={f.id}>
              <b style={{ fontSize: ".88rem" }}>
                {byId.get(f.raisedById)?.name ?? "Someone"}
                {pair ? ` · ${pair.founder.name} and ${pair.mentor.name}` : ""}
              </b>
              <p className="meta" style={{ margin: ".2rem 0 var(--lp-space-4)" }}>&ldquo;{f.body}&rdquo;</p>
              {pair && (
                <>
                  <Link className="linklike" href={`/admin/pairings/${pair.pairing.id}`}>Open the pairing</Link>{" · "}
                </>
              )}
              <form action={closeFlag} style={{ display: "inline" }}>
                <input type="hidden" name="id" value={f.id} />
                <button className="linklike">Resolve</button>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
