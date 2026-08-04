"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import type { FormQuestion } from "@/lib/mentor-form";
import { Field, groupBySection } from "./form-fields";
import { EMPTY_FORM_STATE, type FormState } from "@/lib/form-state";

// A failed submit used to redirect back with only an error string, which threw
// away everything the person had typed. The action now returns what it read
// instead, and the form remounts with those answers already in place.

export function FormRunner({
  questions, action, submitLabel, pendingLabel, buttonClass = "btn", honeypot = false, footer,
}: {
  questions: FormQuestion[];
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  pendingLabel: string;
  buttonClass?: string;
  honeypot?: boolean;
  footer?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, EMPTY_FORM_STATE);
  const sections = groupBySection(questions);

  return (
    <>
      {state.error && (
        <div className="banner bad" role="alert" style={{ marginTop: "1rem" }}>{state.error}</div>
      )}

      {/* Remounting on each attempt is what lets the returned answers land in
          the uncontrolled inputs. */}
      <form key={state.attempt} action={formAction} style={{ marginTop: "1.5rem" }}>
        {honeypot && (
          // Spam trap: a real person never fills this in.
          <div aria-hidden="true" style={{ position: "absolute", left: "-9999px" }}>
            <label htmlFor="website">Website</label>
            <input type="text" id="website" name="website" tabIndex={-1} autoComplete="off" />
          </div>
        )}

        {sections.map(([section, qs]) => (
          <section className="card" key={section} style={{ marginBottom: "1rem" }}>
            <h2>{section}</h2>
            {qs.map((q) => <Field key={q.id} q={q} defaults={state.values} />)}
          </section>
        ))}

        <button className={buttonClass} type="submit" disabled={pending}>
          {pending ? pendingLabel : submitLabel}
        </button>
        {footer}
      </form>
    </>
  );
}

