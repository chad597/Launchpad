import { notFound, redirect } from "next/navigation";
import { currentUser, homeForRole } from "@/lib/session";
import { getFounderProfile, getForm } from "@/lib/forms";
import { FormRunner } from "../../form-runner";
import { submitFounderIntake, submitMentorProfile } from "../../actions";

// One route, two forms. A mentor lands here when they are accepted, a founder
// when they first sign in, and either can come back later to change an answer.
export default async function ProfileSetup() {
  const user = await currentUser();
  if (user.role === "admin") redirect(homeForRole(user.role));

  if (user.role === "founder") {
    const [form, profile] = await Promise.all([
      getForm("founder-intake"),
      getFounderProfile(user.id),
    ]);
    if (!form) notFound();
    const editing = !!profile.intake;
    // First time through, start from what the program already imported.
    const initial = profile.intake ?? {
      company: user.company ?? "",
      availability: user.availability ?? "",
    };

    return (
      <div className="wrap narrow">
        <h1 className="page">{editing ? "Your answers" : form.introTitle}</h1>
        <p className="lede">
          {editing
            ? "Change anything here and your mentor sees the new version. We use these answers to match you, so keep them current."
            : form.introBody}
        </p>
        {!editing && form.introNote && <p className="meta">{form.introNote}</p>}

        <FormRunner
          questions={form.questions}
          action={submitFounderIntake}
          initial={initial}
          submitLabel={editing ? "Save changes" : "Save and continue"}
          pendingLabel="Saving..."
        />
      </div>
    );
  }

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
