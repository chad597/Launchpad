import { getForm } from "@/lib/forms";

export const metadata = { title: "Thanks for applying" };

export default async function ThanksPage() {
  const form = await getForm("mentor-application");
  return (
    <div className="wrap narrow public">
      <div className="logo" style={{ marginBottom: "1.5rem" }}><span className="mark" />LAUNCHPAD</div>
      <div className="card">
        <h1 className="page">{form?.closingTitle ?? "Thanks, that is everything we need."}</h1>
        {(form?.closingBody ?? "").split("\n\n").map((p, i) => (
          <p key={i} style={{ color: "var(--ink-soft)" }}>{p}</p>
        ))}
      </div>
    </div>
  );
}
