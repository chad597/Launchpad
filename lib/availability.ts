// Turns a mentor's own words about when they are free into the days and times
// a founder can actually pick.
//
// The string is typed by hand on the availability screen ("Tuesday and Thursday
// afternoons"), so this reads it loosely and offers nothing when it cannot tell.
// Everything is in the program's timezone, which is what bookMeeting expects.

const DAY_NAMES = [
  "sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday",
] as const;

const SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export interface DayOption {
  /** "Thu" */
  weekday: string;
  /** "13" */
  date: string;
  /** "Aug" */
  month: string;
  /** "2026-08-13", the value posted back. */
  value: string;
}

export interface TimeOption {
  /** "1:45 PM" */
  label: string;
  /** "13:45", the value posted back. */
  value: string;
}

export interface BookingOptions {
  days: DayOption[];
  times: TimeOption[];
}

// Four slots is enough to feel like a choice without becoming a calendar.
const MORNING = ["09:00", "09:45", "10:30", "11:15"];
const AFTERNOON = ["13:00", "13:45", "14:30", "15:15"];
const EVENING = ["17:00", "17:45", "18:30", "19:15"];
const SPREAD = ["09:00", "11:00", "13:00", "15:00"];

function timesFor(text: string): TimeOption[] {
  const morning = /morning/.test(text);
  const afternoon = /afternoon/.test(text);
  const evening = /evening|night/.test(text);
  let values: string[];
  if (morning && !afternoon && !evening) values = MORNING;
  else if (afternoon && !morning && !evening) values = AFTERNOON;
  else if (evening && !morning && !afternoon) values = EVENING;
  else if (morning && afternoon) values = ["09:00", "11:00", "13:00", "15:00"];
  else values = SPREAD;
  return values.map((value) => ({ value, label: label12h(value) }));
}

export function label12h(value: string): string {
  const [h, m] = value.split(":").map(Number);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

function weekdaysIn(text: string): number[] {
  const found = new Set<number>();
  DAY_NAMES.forEach((name, i) => {
    // "tues" and "thurs" are common; the first four letters separate every day
    // except Sunday and Saturday, which differ by the second letter.
    const stem = name.slice(0, 4);
    if (text.includes(name) || text.includes(stem)) found.add(i);
  });
  if (/weekday|week day|any day|flexible|most days/.test(text)) {
    [1, 2, 3, 4, 5].forEach((d) => found.add(d));
  }
  if (/weekend/.test(text)) { found.add(0); found.add(6); }
  return [...found].sort();
}

/**
 * Offers up to four upcoming dates that match what the mentor wrote, starting
 * tomorrow. Returns null when the availability is missing or unreadable, which
 * is the caller's signal to fall back to a plain date and time field.
 */
export function bookingOptions(availability: string | undefined, now: Date): BookingOptions | null {
  const text = (availability ?? "").toLowerCase().trim();
  if (!text) return null;
  const wanted = weekdaysIn(text);
  if (wanted.length === 0) return null;

  // Dates are read in the program's timezone. On Vercel the server runs UTC,
  // where an evening in Greenville is already the next day.
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York", weekday: "short", year: "numeric", month: "short", day: "2-digit",
  });

  const days: DayOption[] = [];
  // Look four weeks ahead at most: a mentor free only on Sundays still gets
  // four options without this walking forever.
  for (let offset = 1; offset <= 28 && days.length < 4; offset++) {
    const at = new Date(now.getTime() + offset * 86400000);
    const p: Record<string, string> = {};
    for (const part of parts.formatToParts(at)) p[part.type] = part.value;
    const dayIndex = SHORT.indexOf(p.weekday);
    if (dayIndex < 0 || !wanted.includes(dayIndex)) continue;
    const monthIndex = MONTHS.indexOf(p.month);
    days.push({
      weekday: p.weekday,
      date: String(Number(p.day)),
      month: p.month,
      value: `${p.year}-${String(monthIndex + 1).padStart(2, "0")}-${p.day}`,
    });
  }
  if (days.length === 0) return null;
  return { days, times: timesFor(text) };
}
