import { notFound, redirect } from "next/navigation";
import { currentUser, homeForRole } from "@/lib/session";
import { getForm } from "@/lib/forms";
import { currentTime } from "@/lib/data";
import {
  prefillFrom, weekStartLabel, weekStartOf, weeklyForFounder, weeklyForWeek,
} from "@/lib/weekly";
import { FormRunner } from "../form-runner";
import { submitWeeklyUpdate } from "../actions";
import { WeeklyTrend } from "./weekly-trend";

// The weekly update. The old version of this form asked twenty-one questions,
// most of which the program already had answers to, and it went unfilled. This
// one asks what changed, opens with last week's numbers in the boxes, and says
// plainly who reads it.
export default async function WeeklyUpdatePage({
  searchParams,
}: {
  searchParams: Promise<{ filed?: string }>;
}) {
  const user = await currentUser();
  if (user.role !== "founder") redirect(homeForRole(user.role));
  const { filed } = await searchParams;

  const now = await currentTime();
  const weekStart = weekStartOf(now);
  const [form, history] = await Promise.all([
    getForm("founder-weekly"),
    weeklyForFounder(user.id, 8),
  ]);
  if (!form) notFound();

  const thisWeek = await weeklyForWeek(user.id, weekStart);
  const lastWeek = history.find((u) => u.weekStart !== weekStart) ?? null;
  const initial = prefillFrom(thisWeek, lastWeek);

  return (
    <>
      <div className="wrap narrow">
      <h1 className="page">{thisWeek ? "Your week, filed" : form.introTitle}</h1>
      <p className="lede">
        {thisWeek
          ? `You filed the week of ${weekStartLabel(weekStart)}. Change anything below and save again; it replaces what you sent rather than adding a second entry.`
          : form.introBody}
      </p>

      {filed && (
        <div className="banner ok" role="status">
          {form.closingBody}
        </div>
      )}

      {lastWeek && !thisWeek && (
        <div className="notice">
          The numbers below are what you told us the week of {weekStartLabel(lastWeek.weekStart)}. Change
          what moved and leave the rest.
        </div>
      )}

      <FormRunner
        questions={form.questions}
        action={submitWeeklyUpdate}
        initial={Object.keys(initial).length ? initial : undefined}
        submitLabel={thisWeek ? "Save changes" : "File this week"}
        pendingLabel="Saving..."
      />

      </div>

      {/* Out of the narrow column: the trend is eight columns wide and reading
          it is the reason to fill the form in again next week. */}
      {history.length > 0 && (
        <div className="wrap" style={{ paddingTop: 0 }}>
          <div className="card">
            <h2>What you have filed</h2>
            <p className="meta" style={{ margin: "0 0 var(--lp-space-5)" }}>
              Your mentor and the Launchpad team see this. Nobody else does.
            </p>
            <WeeklyTrend updates={history} />
          </div>
        </div>
      )}
    </>
  );
}
