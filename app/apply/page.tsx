import { notFound } from "next/navigation";
import { getForm } from "@/lib/forms";
import { FormRunner } from "../form-runner";
import { submitMentorApplication } from "../actions";

export const metadata = {
  title: "Mentor a Launchpad founder",
  description: "Apply to mentor an idea-stage founder in the Launchpad program.",
};

export default async function ApplyPage() {
  const form = await getForm("mentor-application");
  if (!form) notFound();

  return (
    <div className="wrap narrow public">
      <div className="logo" style={{ marginBottom: "1.5rem" }}><span className="mark" />LAUNCHPAD</div>
      <h1 className="page big">{form.introTitle}</h1>
      <p className="lede">{form.introBody}</p>
      {form.introNote && <p className="meta">{form.introNote}</p>}

      <FormRunner
        questions={form.questions}
        action={submitMentorApplication}
        submitLabel="Send my application"
        pendingLabel="Sending..."
        buttonClass="btn big"
        honeypot
        footer={
          <p className="meta" style={{ marginTop: ".8rem" }}>
            We will only use your details to run the mentorship program. Nothing here is shared outside Launchpad.
          </p>
        }
      />
    </div>
  );
}
