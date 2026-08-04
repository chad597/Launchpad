import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getForm } from "@/lib/forms";
import { Field, groupBySection } from "../../form-fields";
import { submitMentorProfile } from "../../actions";

export default async function ProfileSetup({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const user = await currentUser();
  if (user.role !== "mentor") redirect("/");
  const form = await getForm("mentor-profile");
  if (!form) notFound();
  const sections = groupBySection(form.questions);

  return (
    <div className="wrap narrow">
      <h1 className="page">{form.introTitle}</h1>
      <p className="lede">{form.introBody}</p>
      {error && <div className="banner bad" style={{ marginTop: "1rem" }}>{error}</div>}

      <form action={submitMentorProfile} style={{ marginTop: "1.25rem" }}>
        {sections.map(([section, questions]) => (
          <section className="card" key={section} style={{ marginBottom: "1rem" }}>
            <h2>{section}</h2>
            {questions.map((q) => <Field key={q.id} q={q} />)}
          </section>
        ))}
        <button className="btn" type="submit">Save my profile</button>
      </form>
    </div>
  );
}
