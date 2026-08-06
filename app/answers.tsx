import { answerToText, type FormQuestion } from "@/lib/mentor-form";

// Renders stored answers against the form definition that is live today, so a
// question an admin adds shows up everywhere it is read without a code change,
// and a question they archive stops being displayed. Anything left blank is
// skipped rather than shown as an empty row.
export function AnswerList({
  questions, answers,
}: {
  questions: FormQuestion[];
  answers: Record<string, unknown> | null;
}) {
  if (!answers) return null;
  const rows = questions
    .filter((q) => q.type !== "statement" && q.type !== "consent")
    .map((q) => ({ q, text: answerToText(q, answers[q.key]) }))
    .filter((r) => r.text);
  if (!rows.length) return null;

  return (
    <dl className="answers">
      {rows.map(({ q, text }) => (
        <div key={q.id}>
          <dt className="label">{q.label}</dt>
          <dd className="filled">{text}</dd>
        </div>
      ))}
    </dl>
  );
}
