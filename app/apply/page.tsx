import { notFound } from "next/navigation";
import { getForm } from "@/lib/forms";
import { Field, groupBySection } from "../form-fields";
import { submitMentorApplication } from "../actions";

export const metadata = {
  title: "Mentor a Launchpad founder",
  description: "Apply to mentor an idea-stage founder in the Launchpad program.",
};

export default async function ApplyPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const form = await getForm("mentor-application");
  if (!form) notFound();
  const sections = groupBySection(form.questions);

  return (
    <div className="wrap narrow public">
      <div className="logo" style={{ marginBottom: "1.5rem" }}><span className="mark" />LAUNCHPAD</div>
      <h1 className="page big">{form.introTitle}</h1>
      <p className="lede">{form.introBody}</p>
      {form.introNote && <p className="meta">{form.introNote}</p>}

      {error && <div className="banner bad" style={{ marginTop: "1rem" }}>{error}</div>}

      <form action={submitMentorApplication} style={{ marginTop: "1.5rem" }}>
        {/* Spam trap: a real person never fills this in. */}
        <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
          <label htmlFor="website">Website</label>
          <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" />
        </div>

        {sections.map(([section, questions]) => (
          <section className="card" key={section} style={{ marginBottom: "1rem" }}>
            <h2>{section}</h2>
            {questions.map((q) => <Field key={q.id} q={q} />)}
          </section>
        ))}

        <button className="btn big" type="submit">Send my application</button>
        <p className="meta" style={{ marginTop: ".8rem" }}>
          We will only use your details to run the mentorship program. Nothing here is shared outside Launchpad.
        </p>
      </form>
    </div>
  );
}
