"use client";

import { useState } from "react";
import { parsePeople, type ImportRow, type ParsedRow } from "@/lib/csv";
import { importPeople } from "../../actions";

const ROLE_LABEL = {
  founder: "Founder", mentor: "Mentor", instructor: "Instructor", admin: "Admin",
} as const;

export function ImportClient({
  existingEmails,
  cohorts,
}: {
  existingEmails: string[];
  cohorts: { id: string; name: string; ecosystem: string }[];
}) {
  const [text, setText] = useState("");
  const [defaultRole, setDefaultRole] = useState<ImportRow["role"]>("founder");
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const known = new Set(existingEmails.map((e) => e.toLowerCase()));

  function preview() {
    setParsed(parsePeople(text, defaultRole));
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const t = await f.text();
    setText(t);
    setParsed(parsePeople(t, defaultRole));
  }

  const seen = new Set<string>();
  const rowsWithState = (parsed ?? []).map((p) => {
    const email = p.row.email.toLowerCase();
    let state: "new" | "duplicate" | "already" | "problem" = "new";
    if (p.problem) state = "problem";
    else if (known.has(email)) state = "already";
    else if (seen.has(email)) state = "duplicate";
    else seen.add(email);
    return { ...p, state };
  });

  const importable = rowsWithState.filter((r) => r.state === "new").map((r) => r.row);
  const counts = {
    add: importable.length,
    already: rowsWithState.filter((r) => r.state === "already").length,
    dupe: rowsWithState.filter((r) => r.state === "duplicate").length,
    bad: rowsWithState.filter((r) => r.state === "problem").length,
  };

  return (
    <>
      <div className="card">
        <h2>1 · Paste or upload</h2>
        <div className="formrow">
          <label htmlFor="file">CSV file</label>
          <input type="file" id="file" accept=".csv,text/csv" onChange={onFile} />
        </div>
        <div className="formrow">
          <label htmlFor="csv">Or paste the rows here, including the header line</label>
          <textarea id="csv" value={text} onChange={(e) => setText(e.target.value)}
            style={{ minHeight: "9rem", fontFamily: "ui-monospace, monospace", fontSize: ".8rem" }}
            placeholder={"name,email,role,company,stage\nAlex Rivera,alex@trellis.com,founder,Trellis,Idea stage"} />
        </div>
        <div className="formrow" style={{ maxWidth: "16rem" }}>
          <label htmlFor="defaultRole">Role for rows that don&rsquo;t say</label>
          <select id="defaultRole" value={defaultRole}
            onChange={(e) => setDefaultRole(e.target.value as ImportRow["role"])}>
            <option value="founder">Founder</option>
            <option value="mentor">Mentor</option>
            <option value="instructor">Instructor</option>
          </select>
        </div>
        <button type="button" className="btn" onClick={preview} disabled={!text.trim()}>
          Preview
        </button>
        <div className="notice">
          Recognized columns: name (or first name and last name), email, role, company, stage, bio or title, expertise. Extra columns are ignored, so a HubSpot export usually works unedited.
        </div>
      </div>

      {parsed !== null && (
        <div className="card">
          <h2>2 · Check before importing</h2>
          {rowsWithState.length === 0 ? (
            <p className="meta" style={{ margin: 0 }}>
              No rows found. Make sure the first line is a header row with at least name and email columns.
            </p>
          ) : (
            <>
              <div className="stat-row">
                <div className="stat"><div className="n">{counts.add}</div><div className="l">Will be added</div></div>
                <div className="stat"><div className="n">{counts.already}</div><div className="l">Already in the app</div></div>
                <div className="stat"><div className="n">{counts.dupe}</div><div className="l">Repeated in this file</div></div>
                <div className="stat"><div className="n">{counts.bad}</div><div className="l">Need fixing</div></div>
              </div>

              <div className="tablewrap" style={{ maxHeight: "22rem", overflowY: "auto" }}>
                <table className="board">
                  <thead>
                    <tr><th>Line</th><th>Name</th><th>Email</th><th>Role</th><th>Details</th><th>What happens</th></tr>
                  </thead>
                  <tbody>
                    {rowsWithState.map((r) => (
                      <tr key={r.line} style={r.state === "new" ? undefined : { opacity: 0.6 }}>
                        <td className="meta">{r.line}</td>
                        <td>{r.row.name || "—"}</td>
                        <td className="meta">{r.row.email || "—"}</td>
                        <td>{ROLE_LABEL[r.row.role]}</td>
                        <td className="meta">
                          {[r.row.company, r.row.stage, r.row.bio].filter(Boolean).join(" · ")}
                          {r.row.expertise?.length ? ` · ${r.row.expertise.join(", ")}` : ""}
                        </td>
                        <td>
                          {r.state === "new" && <span className="pill good">Add</span>}
                          {r.state === "already" && <span className="pill info">Skip, already here</span>}
                          {r.state === "duplicate" && <span className="pill warn">Skip, repeated</span>}
                          {r.state === "problem" && <span className="pill crit">{r.problem}</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <form action={importPeople} style={{ marginTop: "1rem" }}>
                <input type="hidden" name="rows" value={JSON.stringify(importable)} />
                {cohorts.length > 0 && (
                  <>
                    <div className="formrow" style={{ maxWidth: "20rem" }}>
                      <label htmlFor="cohortId">Cohort</label>
                      <select id="cohortId" name="cohortId" defaultValue={cohorts[0].id}>
                        {cohorts.map((c) => (
                          <option key={c.id} value={c.id}>{c.ecosystem} · {c.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="formrow">
                      <label style={{ display: "flex", gap: ".4rem", textTransform: "none", letterSpacing: 0, fontWeight: 400, fontSize: ".85rem", color: "var(--ink)" }}>
                        <input type="checkbox" name="joinCohort" defaultChecked style={{ width: "auto" }} />
                        Add imported founders to this cohort
                      </label>
                      <label style={{ display: "flex", gap: ".4rem", textTransform: "none", letterSpacing: 0, fontWeight: 400, fontSize: ".85rem", color: "var(--ink)" }}>
                        <input type="checkbox" name="joinPool" style={{ width: "auto" }} />
                        Add imported mentors to this cohort&rsquo;s 1:1 pool
                      </label>
                    </div>
                  </>
                )}
                <button className="btn" type="submit" disabled={counts.add === 0}>
                  Import {counts.add} {counts.add === 1 ? "person" : "people"}
                </button>
                <div className="notice">
                  Only the rows marked Add are imported. Nothing is overwritten: people already in the app are left exactly as they are.
                </div>
              </form>
            </>
          )}
        </div>
      )}
    </>
  );
}
