import { bookMeeting } from "./actions";

// The booking control belongs on both home screens, whether or not a meeting
// is already on the calendar. Nothing booked is the program's strongest
// warning sign, so booking must never be more than one field away.
export function BookMeeting({
  pairingId, hasNext, otherFirst, availability,
}: {
  pairingId: string;
  hasNext: boolean;
  otherFirst: string;
  availability?: string;
}) {
  return (
    <form action={bookMeeting}>
      <input type="hidden" name="pairingId" value={pairingId} />
      <div className="formrow">
        <label htmlFor={`when_${pairingId}`}>
          {hasNext ? "Book the one after that" : "Date and time"}
        </label>
        <input type="datetime-local" id={`when_${pairingId}`} name="scheduledAt" required />
        {!hasNext && availability && (
          <p className="help">{otherFirst} is usually free: {availability}</p>
        )}
      </div>
      <button className={hasNext ? "btn ghost" : "btn"} type="submit">
        {hasNext ? "Book another meeting" : "Book this meeting"}
      </button>
    </form>
  );
}
