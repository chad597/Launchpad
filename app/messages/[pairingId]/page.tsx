import { notFound } from "next/navigation";
import { currentUser } from "@/lib/session";
import { getPairing, getUser, messagesForPairing } from "@/lib/store";
import { postMessage } from "../../actions";

function fmt(dt: string) {
  return new Date(dt).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York",
  });
}

export default async function Thread({ params }: { params: Promise<{ pairingId: string }> }) {
  const { pairingId } = await params;
  const user = await currentUser();
  const pairing = getPairing(pairingId);
  if (!pairing) notFound();
  const founder = getUser(pairing.founderId)!;
  const mentor = getUser(pairing.mentorId)!;
  const isMember = user.id === founder.id || user.id === mentor.id;
  const isStaff = user.role === "admin";
  if (!isMember && !isStaff) {
    return <div className="wrap narrow"><p className="meta">This conversation is private to the pair and program staff.</p></div>;
  }
  const msgs = messagesForPairing(pairingId);
  const other = user.id === founder.id ? mentor : founder;

  return (
    <div className="wrap narrow">
      <h1 className="page">{isStaff && !isMember ? `${founder.name} · ${mentor.name}` : other.name}</h1>
      <p className="sub">{isStaff && !isMember
        ? "Staff view. This access is recorded in the audit log."
        : "Program staff can access conversations for safety and program quality."}</p>
      <div className="card">
        {msgs.map((m) => {
          const sender = getUser(m.senderId)!;
          const mine = m.senderId === user.id;
          return (
            <div className="msg" key={m.id}>
              <span className={`avatar${mine ? " o" : ""}`}>{sender.name.split(" ").map((w) => w[0]).join("")}</span>
              <div><div className="bubble">{m.body}</div><div className="t">{sender.name.split(" ")[0]} · {fmt(m.createdAt)}</div></div>
            </div>
          );
        })}
        {isMember && (
          <>
            <hr className="divider" />
            <form action={postMessage}>
              <input type="hidden" name="pairingId" value={pairingId} />
              <input type="hidden" name="senderId" value={user.id} />
              <div className="formrow">
                <label htmlFor="body">Message {other.name.split(" ")[0]}</label>
                <textarea id="body" name="body" required />
              </div>
              <button className="btn" type="submit">Send</button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
