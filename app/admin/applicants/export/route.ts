import { currentUser } from "@/lib/session";
import { getFormForEditing, listApplications } from "@/lib/forms";
import { answerToText } from "@/lib/mentor-form";

function cell(v: string) {
  // Applicants write free text, so a leading =, +, -, or @ would be executed
  // as a formula when the admin opens the file in Excel or Sheets.
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

// One column per question, including questions since removed, so an export
// never silently drops answers people gave.
export async function GET() {
  const user = await currentUser();
  if (user.role !== "admin") {
    return new Response("Not authorized", { status: 403 });
  }
  const [form, apps] = await Promise.all([
    getFormForEditing("mentor-application"),
    listApplications(),
  ]);
  const questions = (form?.questions ?? []).filter((q) => q.type !== "statement");

  const header = ["Submitted", "Status", ...questions.map((q) => q.label)];
  const rows = apps.map((a) => [
    new Date(a.submittedAt).toISOString(),
    a.status,
    ...questions.map((q) => answerToText(q, a.answers[q.key])),
  ]);

  const csv = [header, ...rows].map((r) => r.map((c) => cell(String(c ?? ""))).join(",")).join("\n");
  const stamp = new Date().toISOString().slice(0, 10);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="mentor-applicants-${stamp}.csv"`,
    },
  });
}
