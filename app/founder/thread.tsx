"use client";

import { useEffect, useRef } from "react";

// The conversation sits open on the founder's home screen rather than behind a
// link, because it is the thing they can use the moment they sign in, on any
// day, meeting or not.
export interface ThreadMessage {
  id: string;
  body: string;
  createdAt: string;
  senderInitials: string;
  senderFirst: string;
  mine: boolean;
}

export function Thread({
  messages, pairingId, otherFirst, action,
}: {
  messages: ThreadMessage[];
  pairingId: string;
  otherFirst: string;
  action: (formData: FormData) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);

  // Newest message at the bottom, in view, without the founder scrolling.
  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  return (
    <>
      <div ref={scroller} className="threadscroll">
        {messages.length === 0 ? (
          <p className="meta" style={{ margin: 0 }}>
            Nothing here yet. A short message between meetings is often worth more than waiting for the next one.
          </p>
        ) : messages.map((m) => (
          <div className="msg" key={m.id}>
            <span className={`avatar${m.mine ? " o" : ""}`}>{m.senderInitials}</span>
            <div>
              <div className="bubble">{m.body}</div>
              <div className="t">{m.senderFirst} · {m.createdAt}</div>
            </div>
          </div>
        ))}
      </div>
      <form action={action}>
        <input type="hidden" name="pairingId" value={pairingId} />
        <div className="formrow" style={{ marginBottom: ".5rem" }}>
          <label htmlFor="body" className="visually-hidden">Message {otherFirst}</label>
          <textarea id="body" name="body" required placeholder={`Message ${otherFirst}`}
            style={{ minHeight: "3.4rem" }} />
        </div>
        <button className="btn" type="submit">Send</button>
      </form>
    </>
  );
}
