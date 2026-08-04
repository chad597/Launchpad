import { currentUser } from "@/lib/session";
import { getUser, pairingsForUser } from "@/lib/data";
import { submitFlag } from "../actions";

export default async function FlagPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const { sent, error } = await searchParams;
  const user = await currentUser();
  const pairs = await pairingsForUser(user.id);
  const counterparts = await Promise.all(
    pairs.map(async (p) => ({
      pairing: p,
      other: await getUser(user.id === p.founderId ? p.mentorId : p.founderId),
    }))
  );

  return (
    <div className="wrap narrow">
      <h1 className="page">Tell the Launchpad team</h1>
      <p className="sub">
        A match that isn&rsquo;t clicking, a pattern you keep seeing, or a concern about conduct. This goes to program staff only, not to the other person.
      </p>
      <div className="card">
        {sent ? (
          <>
            <p style={{ fontWeight: 700, margin: 0 }}>Thank you, we have it</p>
            <p className="meta">Someone from the team will follow up. Reassignment is a normal part of finding the right fit, not a failure.</p>
          </>
        ) : (
          <form action={submitFlag}>
            <div className="formrow">
              <label htmlFor="category">What kind of thing is this?</label>
              <select id="category" name="category" defaultValue="match_not_working">
                <option value="match_not_working">This match isn&rsquo;t working</option>
                <option value="pattern_risk">A pattern across founders worth naming</option>
                <option value="conduct">A conduct concern</option>
                <option value="other">Something else</option>
              </select>
            </div>
            {counterparts.length > 0 && (
              <div className="formrow">
                <label htmlFor="pairingId">Which pairing? (optional)</label>
                <select id="pairingId" name="pairingId" defaultValue="">
                  <option value="">Not about a specific pairing</option>
                  {counterparts.map((c) => (
                    <option key={c.pairing.id} value={c.pairing.id}>{c.other?.name}</option>
                  ))}
                </select>
              </div>
            )}
            <div className="formrow">
              <label htmlFor="body">What&rsquo;s going on?</label>
              <textarea id="body" name="body" required style={{ minHeight: "8rem" }} />
            </div>
            {error && <p className="meta" style={{ color: "var(--crit)" }}>{error}</p>}
            <button className="btn" type="submit">Send to the team</button>
          </form>
        )}
        <div className="notice">
          We&rsquo;d much rather hear about something in week 4 than find out in week 12.
        </div>
      </div>
    </div>
  );
}
