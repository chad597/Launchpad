"use client";

import { useState } from "react";
import type { BookingOptions } from "@/lib/availability";

// Day cards and time slots, in place of the browser's date and time widget.
// Every option shown is one the other person said they could take, which is
// the point: the availability they typed was sitting in the data unused.
//
// The selection posts as the same "YYYY-MM-DDTHH:mm" string the native input
// produced, so the server side is unchanged.
export function DayTimePicker({
  options, name, otherFirst, submitLabel, buttonClass = "btn", pending = false,
}: {
  options: BookingOptions;
  name: string;
  otherFirst: string;
  submitLabel: string;
  buttonClass?: string;
  pending?: boolean;
}) {
  const [day, setDay] = useState<number | null>(null);
  const [time, setTime] = useState<number | null>(null);

  const chosen = day !== null && time !== null
    ? `${options.days[day].value}T${options.times[time].value}`
    : "";
  const summary = day !== null && time !== null
    ? `${options.days[day].weekday}, ${options.days[day].month} ${options.days[day].date} at ${options.times[time].label}`
    : `Pick a day and a time ${otherFirst} is free`;

  return (
    <>
      <input type="hidden" name={name} value={chosen} />

      <div className="lp-label lp-label-quiet">Pick a day</div>
      <div className="lp-daygrid" style={{ marginBottom: "22px" }}>
        {options.days.map((d, i) => (
          <button key={d.value} type="button" className="lp-daycard" aria-pressed={day === i}
            onClick={() => setDay(i)}>
            <div className="lp-daycard-wd">{d.weekday}</div>
            <div className="lp-daycard-dd">{d.date}</div>
            <div className="lp-daycard-mo">{d.month}</div>
          </button>
        ))}
      </div>

      <div className="lp-label lp-label-quiet">Pick a time</div>
      <div className="lp-slots" style={{ marginBottom: "22px" }}>
        {options.times.map((t, i) => (
          <button key={t.value} type="button" className="lp-slot" aria-pressed={time === i}
            onClick={() => setTime(i)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="lp-divider" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "12px 18px" }}>
        {/* The button stays visible and disabled rather than appearing once a
            time is chosen, so nothing moves under the cursor. */}
        <button className={buttonClass} type="submit" disabled={pending || !chosen}>
          {pending ? "Booking..." : submitLabel}
        </button>
        <span className="meta">{summary}</span>
      </div>
    </>
  );
}
