import { notFound, redirect } from "next/navigation";
import { currentUser, homeForRole } from "@/lib/session";
import { getFounderProfile, getForm } from "@/lib/forms";
import { getUser, pairingsForUser } from "@/lib/data";
import { FormRunner } from "../../form-runner";
import { submitFounderBrief } from "../../actions";

// Written to a named person rather than to the program, which is why it waits
// until the match exists and why the page leads with who is going to read it.
export default async function FounderBrief() {
  const user = await currentUser();
  if (user.role !== "founder") redirect(homeForRole(user.role));
  const pairing = (await pairingsForUser(user.id))[0];
  if (!pairing) redirect("/founder");

  const [mentor, form, profile] = await Promise.all([
    getUser(pairing.mentorId),
    getForm("founder-brief"),
    getFounderProfile(user.id),
  ]);
  if (!form || !mentor) notFound();
  const first = mentor.name.split(" ")[0];
  const editing = !!profile.brief;

  return (
    <div className="wrap narrow">
      <h1 className="page">{editing ? `What ${first} reads` : `Brief ${first}.`}</h1>
      <p className="lede">
        {editing
          ? `${first} sees this as soon as you save it, so change anything that has moved on.`
          : form.introBody}
      </p>

      <div className="card">
        <div style={{ display: "flex", gap: ".7rem", alignItems: "center" }}>
          <span className="avatar lg">{mentor.name.split(" ").map((w) => w[0]).join("")}</span>
          <div>
            <div style={{ fontWeight: 700 }}>{mentor.name}</div>
            <div className="meta">{mentor.bio}</div>
          </div>
        </div>
        {pairing.matchRationale && (
          <p className="meta" style={{ margin: ".6rem 0 0" }}>
            <b style={{ color: "var(--ink-soft)" }}>Why you were matched:</b> {pairing.matchRationale}
          </p>
        )}
      </div>

      <FormRunner
        questions={form.questions}
        action={submitFounderBrief}
        initial={profile.brief ?? undefined}
        submitLabel={editing ? "Save changes" : `Send it to ${first}`}
        pendingLabel="Saving..."
      />
    </div>
  );
}
