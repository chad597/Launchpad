import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getFormForEditing } from "@/lib/forms";
import { QUESTION_TYPES } from "@/lib/mentor-form";
import { AdminNav } from "../../nav";
import {
  createQuestion, editFormCopy, editQuestion, removeQuestion, reorderQuestion, restoreQuestion,
} from "../../../actions";

const TYPE_LABEL = Object.fromEntries(QUESTION_TYPES.map((t) => [t.value, t.label]));
const HAS_OPTIONS = ["dropdown", "multi_select", "ranked_select"];

export default async function FormEditor({
  params, searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; added?: string; edit?: string }>;
}) {
  const { slug } = await params;
  const { error, added, edit } = await searchParams;
  const user = await currentUser();
  if (user.role !== "admin") {
    return <div className="wrap"><p className="meta">This view is for program admins.</p></div>;
  }
  const form = await getFormForEditing(slug);
  if (!form) notFound();
  const live = form.questions.filter((q) => !q.archived);
  const archived = form.questions.filter((q) => q.archived);

  return (
    <div className="wrap">
      <AdminNav current="/admin/forms" />
      <p className="meta"><Link href="/admin/forms">All forms</Link></p>
      <h1 className="page">{form.name}</h1>
      <p className="sub">{live.length} live questions. Every answer is stored against the question&rsquo;s key, so renaming a label never loses data.</p>
      {added && <div className="banner ok">Added &ldquo;{added}&rdquo;.</div>}
      {error && <div className="banner bad">{error}</div>}

      {live.map((q, i) => {
        const isEditing = edit === q.id;
        return (
          <div className="card qcard" key={q.id}>
            <div className="qtop">
              <div>
                <span className="pill info">{TYPE_LABEL[q.type] ?? q.type}</span>{" "}
                {q.required && <span className="pill warn">Required</span>}{" "}
                <span className="meta">{q.section} · key <code>{q.key}</code></span>
              </div>
              <div className="qtools">
                <form action={reorderQuestion} className="inline-form">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="dir" value="-1" />
                  <button className="linklike" disabled={i === 0} aria-label="Move up">↑</button>
                </form>
                <form action={reorderQuestion} className="inline-form">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={q.id} />
                  <input type="hidden" name="dir" value="1" />
                  <button className="linklike" disabled={i === live.length - 1} aria-label="Move down">↓</button>
                </form>
                <Link className="linklike" href={isEditing ? `/admin/forms/${slug}` : `/admin/forms/${slug}?edit=${q.id}`}>
                  {isEditing ? "Cancel" : "Edit"}
                </Link>
                <form action={removeQuestion} className="inline-form">
                  <input type="hidden" name="slug" value={slug} />
                  <input type="hidden" name="id" value={q.id} />
                  <button className="linklike">Remove</button>
                </form>
              </div>
            </div>

            {isEditing ? (
              <form action={editQuestion} style={{ marginTop: ".6rem" }}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="id" value={q.id} />
                <div className="formrow"><label>Label</label>
                  <input type="text" name="label" defaultValue={q.label} /></div>
                <div className="formrow"><label>Helper text</label>
                  <input type="text" name="help" defaultValue={q.help ?? ""} /></div>
                {(q.type === "statement" || q.type === "consent") && (
                  <div className="formrow"><label>Body copy</label>
                    <textarea name="body" defaultValue={q.body ?? ""} style={{ minHeight: "8rem" }} /></div>
                )}
                {HAS_OPTIONS.includes(q.type) && (
                  <div className="formrow">
                    <label>Options, one per line. Use &ldquo;Label | description&rdquo; to add a description.</label>
                    <textarea name="options" style={{ minHeight: "7rem" }}
                      defaultValue={(q.options ?? []).map((o) => o.description ? `${o.label} | ${o.description}` : o.label).join("\n")} />
                  </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: ".8rem" }}>
                  <div className="formrow"><label>Section</label>
                    <input type="text" name="section" defaultValue={q.section} /></div>
                  {(q.type === "ranked_select" || q.type === "multi_select") && (
                    <div className="formrow"><label>Maximum choices</label>
                      <input type="text" inputMode="numeric" name="maxSelect" defaultValue={q.maxSelect ?? ""} /></div>
                  )}
                </div>
                <label className="checkline" style={{ marginBottom: ".7rem" }}>
                  <input type="checkbox" name="required" defaultChecked={q.required} />
                  <span>Required</span>
                </label>
                <button className="btn" type="submit">Save changes</button>
              </form>
            ) : (
              <>
                <div className="qlabel">{q.label}</div>
                {q.help && <p className="meta" style={{ margin: ".2rem 0 0" }}>{q.help}</p>}
                {HAS_OPTIONS.includes(q.type) && (
                  <p className="meta" style={{ margin: ".4rem 0 0" }}>
                    {(q.options ?? []).map((o) => o.label).join(" · ")}
                    {q.maxSelect ? ` — up to ${q.maxSelect}` : ""}
                  </p>
                )}
              </>
            )}
          </div>
        );
      })}

      {archived.length > 0 && (
        <div className="card" style={{ marginTop: "1.25rem" }}>
          <h2>Removed questions</h2>
          <p className="meta" style={{ margin: "0 0 .6rem" }}>
            These no longer appear on the form, but answers already collected are kept and still show in the applicant record and the export.
          </p>
          {archived.map((q) => (
            <div key={q.id} style={{ display: "flex", gap: ".6rem", alignItems: "baseline", margin: ".35rem 0" }}>
              <span style={{ color: "var(--ink)" }}>{q.label}</span>
              <span className="meta">key <code>{q.key}</code></span>
              <form action={restoreQuestion} className="inline-form" style={{ marginLeft: "auto" }}>
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="id" value={q.id} />
                <button className="linklike">Put it back</button>
              </form>
              <form action={removeQuestion} className="inline-form">
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="id" value={q.id} />
                <input type="hidden" name="permanent" value="yes" />
                <button className="linklike">Delete for good</button>
              </form>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: "1.25rem", borderColor: "var(--orange)" }}>
        <h2>Add a question</h2>
        <form action={createQuestion}>
          <input type="hidden" name="slug" value={slug} />
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: ".8rem" }}>
            <div className="formrow"><label htmlFor="nq_label">Question</label>
              <input type="text" id="nq_label" name="label" required placeholder="What can you help a founder do?" /></div>
            <div className="formrow"><label htmlFor="nq_type">Type</label>
              <select id="nq_type" name="type" defaultValue="short_text">
                {QUESTION_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label} — {t.note}</option>)}
              </select>
            </div>
          </div>
          <div className="formrow"><label htmlFor="nq_help">Helper text</label>
            <input type="text" id="nq_help" name="help" placeholder="Optional. Shown under the question." /></div>
          <div className="formrow">
            <label htmlFor="nq_options">Options, one per line</label>
            <textarea id="nq_options" name="options" placeholder={"Only for pick-one, pick-several, and pick-and-rank.\nFinding first customers\nPricing | Setting and testing price"} />
          </div>
          <div className="formrow"><label htmlFor="nq_body">Body copy</label>
            <textarea id="nq_body" name="body" placeholder="Only for statements and agreements." /></div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: ".8rem" }}>
            <div className="formrow"><label htmlFor="nq_section">Section</label>
              <input type="text" id="nq_section" name="section" placeholder="About you" /></div>
            <div className="formrow"><label htmlFor="nq_max">Maximum choices</label>
              <input type="text" inputMode="numeric" id="nq_max" name="maxSelect" placeholder="3" /></div>
            <div className="formrow"><label htmlFor="nq_key">Key</label>
              <input type="text" id="nq_key" name="key" placeholder="auto from the label" /></div>
          </div>
          <label className="checkline" style={{ marginBottom: ".7rem" }}>
            <input type="checkbox" name="required" />
            <span>Required</span>
          </label>
          <button className="btn" type="submit">Add question</button>
          <div className="notice">
            A new question appears on the form straight away, and shows up as a new column in the applicants table and the CSV export. Existing submissions will show it as blank.
          </div>
        </form>
      </div>

      <div className="card" style={{ marginTop: "1.25rem" }}>
        <h2>Intro and closing copy</h2>
        <form action={editFormCopy}>
          <input type="hidden" name="slug" value={slug} />
          <div className="formrow"><label>Opening headline</label>
            <input type="text" name="introTitle" defaultValue={form.introTitle} /></div>
          <div className="formrow"><label>Opening paragraph</label>
            <textarea name="introBody" defaultValue={form.introBody} /></div>
          <div className="formrow"><label>Small print under the opening</label>
            <input type="text" name="introNote" defaultValue={form.introNote ?? ""} /></div>
          <div className="formrow"><label>Closing headline</label>
            <input type="text" name="closingTitle" defaultValue={form.closingTitle} /></div>
          <div className="formrow"><label>Closing paragraph</label>
            <textarea name="closingBody" defaultValue={form.closingBody} style={{ minHeight: "7rem" }} /></div>
          <button className="btn" type="submit">Save copy</button>
        </form>
      </div>
    </div>
  );
}
