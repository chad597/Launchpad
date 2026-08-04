import Link from "next/link";
import { notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getApplication, getFormForEditing } from "@/lib/forms";
import { answerToText } from "@/lib/mentor-form";
import { AdminNav } from "../../nav";
import { reviewApplicant } from "../../../actions";

const STATUS_PILL = { new: "info", reviewing: "warn", accepted: "good", declined: "crit" } as const;

export default async function ApplicantDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (user.role !== "admin") {
    return <div className="wrap"><p className="meta">This view is for program staff.</p></div>;
  }
  const [app, form] = await Promise.all([getApplication(id), getFormForEditing("mentor-application")]);
  if (!app) notFound();
  const questions = (form?.questions ?? []).filter((q) => q.type !== "statement");

  return (
    <div className="wrap narrow">
      <AdminNav current="/admin/applicants" />
      <p className="meta"><Link href="/admin/applicants">All applicants</Link></p>
      <h1 className="page">{app.name}</h1>
      <p className="sub">
        <span className={`pill ${STATUS_PILL[app.status]}`}>{app.status}</span>{" "}
        {app.email} · applied {new Date(app.submittedAt).toLocaleDateString("en-US", { month: "long", day: "numeric" })}
      </p>

      <div className="card">
        {questions.map((q) => {
          const text = answerToText(q, app.answers[q.key]);
          return (
            <div className="formrow" key={q.key}>
              <span className="label">{q.label}{q.archived ? " (question since removed)" : ""}</span>
              <div className="filled">{text || <span className="meta">No answer</span>}</div>
            </div>
          );
        })}
      </div>

      {user.role === "admin" && app.status !== "accepted" && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h2>Decision</h2>
          <form action={reviewApplicant}>
            <input type="hidden" name="id" value={app.id} />
            <div className="formrow">
              <label htmlFor="note">Note, for the record</label>
              <input type="text" id="note" name="note" defaultValue={app.reviewNote ?? ""} />
            </div>
            <button className="btn" name="status" value="accepted" type="submit">Accept as a mentor</button>{" "}
            <button className="btn ghost" name="status" value="reviewing" type="submit">Mark as reviewing</button>{" "}
            <button className="btn ghost" name="status" value="declined" type="submit">Decline</button>
            <div className="notice">
              Accepting creates their mentor account with everything they told us already filled in. They complete the short profile form the first time they sign in.
            </div>
          </form>
        </div>
      )}

      {app.status === "accepted" && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <p className="meta" style={{ margin: 0 }}>
            Accepted. Their mentor account exists, and the profile form is waiting for them at first sign-in.
          </p>
        </div>
      )}
    </div>
  );
}
