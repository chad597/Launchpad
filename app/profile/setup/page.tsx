import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getForm } from "@/lib/forms";
import { FormRunner } from "../../form-runner";
import { submitMentorProfile } from "../../actions";

export default async function ProfileSetup() {
  const user = await currentUser();
  if (user.role !== "mentor") redirect("/");
  const form = await getForm("mentor-profile");
  if (!form) notFound();

  return (
    <div className="wrap narrow">
      <h1 className="page">{form.introTitle}</h1>
      <p className="lede">{form.introBody}</p>

      <FormRunner
        questions={form.questions}
        action={submitMentorProfile}
        submitLabel="Save my profile"
        pendingLabel="Saving..."
      />
    </div>
  );
}
