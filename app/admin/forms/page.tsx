import Link from "next/link";
import { currentUser } from "@/lib/session";
import { listForms } from "@/lib/forms";

export default async function FormsIndex() {
  const user = await currentUser();
  if (user.role !== "admin") {
    return <div className="wrap"><p className="meta">This view is for program admins.</p></div>;
  }
  const forms = await listForms();

  return (
    <div className="wrap">
      <h1 className="page">Intake forms</h1>
      <p className="sub">
        Edit the questions people answer. Changes are live immediately, and answers already collected keep their meaning because every question has a fixed key behind the label.
      </p>

      {forms.map((f) => (
        <div className="card" key={f.slug} style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", gap: ".8rem", alignItems: "baseline", flexWrap: "wrap" }}>
            <h3 style={{ margin: 0 }}>{f.name}</h3>
            <span className="meta">{f.count} questions</span>
            <span className="meta" style={{ marginLeft: "auto" }}>
              {f.slug === "mentor-application"
                ? <>Public at <code>/apply</code></>
                : <>Shown at a mentor&rsquo;s first sign-in</>}
            </span>
          </div>
          <p className="meta" style={{ margin: ".4rem 0 .8rem" }}>
            {f.slug === "mentor-application"
              ? "Anyone can fill this in. Submissions land in Applicants."
              : "Completed once a mentor is accepted. Answers land on their profile and feed matching."}
          </p>
          <Link className="btn" href={`/admin/forms/${f.slug}`}>Edit questions</Link>{" "}
          {f.slug === "mentor-application" && (
            <a className="btn ghost" href="/apply" target="_blank" rel="noreferrer">View the live form</a>
          )}
        </div>
      ))}
    </div>
  );
}
