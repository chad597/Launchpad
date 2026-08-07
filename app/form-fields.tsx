import type { FormQuestion } from "@/lib/mentor-form";

// Renders one question as form inputs. Shared by the public application and
// the mentor profile form so both always match the stored definition.
// `defaults` carries answers back after a failed submit so nobody has to
// retype what they already filled in.
export function Field({ q, defaults }: { q: FormQuestion; defaults?: Record<string, unknown> }) {
  const id = `f_${q.key}`;
  const prior = defaults?.[q.key];

  if (q.type === "statement") {
    return (
      <div className="statement">
        <h3>{q.label}</h3>
        {(q.body ?? "").split("\n\n").map((para, i) => <Para key={i} text={para} />)}
      </div>
    );
  }

  if (q.type === "consent") {
    return (
      <div className="formrow">
        {(q.body ?? "").split("\n\n").map((para, i) => (
          <p className="meta" key={i} style={{ margin: "0 0 .5rem" }}>{para}</p>
        ))}
        <label className="checkline">
          <input type="checkbox" id={id} name={q.key} value="yes" required={q.required}
            defaultChecked={prior === true} />
          <span>{q.label}{q.required && " *"}</span>
        </label>
      </div>
    );
  }

  const labelEl = (
    <>
      <label htmlFor={id}>{q.label}{q.required && " *"}</label>
      {q.help && <p className="help">{q.help}</p>}
    </>
  );

  if (q.type === "long_text") {
    return <div className="formrow">{labelEl}<textarea id={id} name={q.key} required={q.required} defaultValue={asText(prior)} style={{ minHeight: "6.5rem" }} /></div>;
  }

  if (q.type === "dropdown") {
    return (
      <div className="formrow">{labelEl}
        <select id={id} name={q.key} required={q.required} defaultValue={asText(prior)}>
          <option value="" disabled>Choose one</option>
          {q.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}{o.description ? ` — ${o.description}` : ""}
            </option>
          ))}
        </select>
      </div>
    );
  }

  if (q.type === "multi_select") {
    return (
      <fieldset className="formrow fieldset">
        <legend>{q.label}{q.required && " *"}</legend>
        {q.help && <p className="help">{q.help}</p>}
        <div className="checkgrid wide">
          {q.options?.map((o) => (
            <label className="checkline" key={o.value}>
              <input type="checkbox" name={q.key} value={o.value}
                defaultChecked={asList(prior).includes(o.value)} />
              <span>
                <strong>{o.label}</strong>
                {o.description && <em className="optdesc">{o.description}</em>}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
    );
  }

  if (q.type === "ranked_select") {
    // Explicit rank dropdowns: no client JS, and the order is unambiguous.
    const n = q.maxSelect ?? 3;
    const ordinals = ["Strongest", "Second", "Third", "Fourth", "Fifth"];
    return (
      <fieldset className="formrow fieldset">
        <legend>{q.label}{q.required && " *"}</legend>
        {q.help && <p className="help">{q.help}</p>}
        <div className="rankgrid">
          {Array.from({ length: n }, (_, i) => (
            <div key={i}>
              <label htmlFor={`${id}_${i}`}>{ordinals[i] ?? `Choice ${i + 1}`}</label>
              <select id={`${id}_${i}`} name={`${q.key}__${i}`} defaultValue={asList(prior)[i] ?? ""}
                required={q.required && i === 0}>
                <option value="">{i === 0 ? "Choose one" : "Optional"}</option>
                {q.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
          ))}
        </div>
      </fieldset>
    );
  }

  if (q.type === "number") {
    // Not type="number": a spinner on a phone keypad is worse than a plain
    // numeric keyboard, and an empty box has to stay a legitimate answer.
    return (
      <div className="formrow">{labelEl}
        <input type="text" inputMode="numeric" pattern="[0-9]*[.,]?[0-9]*" id={id} name={q.key}
          required={q.required} defaultValue={asText(prior)} style={{ maxWidth: "12rem" }} />
      </div>
    );
  }

  const inputType = q.type === "email" ? "email" : q.type === "phone" ? "tel" : q.type === "url" ? "url" : "text";
  return (
    <div className="formrow">{labelEl}
      <input type={inputType} id={id} name={q.key} required={q.required} defaultValue={asText(prior)}
        placeholder={q.type === "url" ? "https://" : undefined} />
    </div>
  );
}

function asText(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asList(v: unknown): string[] {
  return Array.isArray(v) ? v.map(String) : [];
}

function Para({ text }: { text: string }) {
  if (text.startsWith("**") && text.endsWith("**")) {
    return <h4 className="stmt-h">{text.slice(2, -2)}</h4>;
  }
  if (text.startsWith("- ")) {
    return (
      <ul>
        {text.split("\n").map((line, i) => <li key={i}>{line.replace(/^- /, "")}</li>)}
      </ul>
    );
  }
  return <p>{text}</p>;
}

export function groupBySection(questions: FormQuestion[]): [string, FormQuestion[]][] {
  const out: [string, FormQuestion[]][] = [];
  for (const q of questions) {
    const last = out[out.length - 1];
    if (last && last[0] === q.section) last[1].push(q);
    else out.push([q.section, [q]]);
  }
  return out;
}
