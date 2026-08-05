import { bookingOptions } from "@/lib/availability";
import { bookMeeting } from "./actions";
import { DayTimePicker } from "./day-time-picker";

// The booking control belongs on both home screens, whether or not a meeting
// is already on the calendar. Nothing booked is the program's strongest
// warning sign, so booking must never be more than one field away.
//
// Days and times come from what the other person said about when they are
// free. With nothing on file it falls back to a plain date and time field and
// says why.
export function BookMeeting({
  pairingId, hasNext, otherFirst, availability, now, availabilityIsMine = false,
}: {
  pairingId: string;
  hasNext: boolean;
  otherFirst: string;
  availability?: string;
  now: Date;
  /** True on the mentor's own screen, where the availability on file is theirs. */
  availabilityIsMine?: boolean;
}) {
  const options = bookingOptions(availability, now);

  return (
    <form action={bookMeeting}>
      <input type="hidden" name="pairingId" value={pairingId} />
      <h3 style={{ margin: "0 0 3px" }}>
        {hasNext ? "Schedule the next meeting" : "Schedule your first meeting"}
      </h3>
      <p className="meta" style={{ margin: "0 0 22px" }}>
        {options
          ? availabilityIsMine
            ? `These are the times you said you are free. ${otherFirst} sees the meeting as soon as you book it.`
            : `${otherFirst} is usually free ${availability}.`
          : availabilityIsMine
            ? "Set your availability and these become day and time options instead of a blank field."
            : `${otherFirst} has not said when they are free, so pick a time and check it with them.`}
      </p>

      {options ? (
        <DayTimePicker
          options={options}
          name="scheduledAt"
          otherFirst={otherFirst}
          submitLabel="Book this meeting"
          buttonClass={hasNext ? "btn ghost" : "btn"}
        />
      ) : (
        <>
          <div className="formrow">
            <label htmlFor={`when_${pairingId}`}>Date and time</label>
            <input type="datetime-local" id={`when_${pairingId}`} name="scheduledAt" required />
          </div>
          <button className={hasNext ? "btn ghost" : "btn"} type="submit">Book this meeting</button>
        </>
      )}
    </form>
  );
}
