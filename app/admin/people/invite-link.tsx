"use client";

import { useState } from "react";

// The link is the whole delivery mechanism, so the copy button matters more
// than it looks: an admin sending 110 of these should never be selecting text
// by hand.
export function InviteLinkBanner({ url, name }: { url: string; name: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <div className="banner ok" style={{ display: "block" }}>
      <p style={{ margin: "0 0 .5rem", fontWeight: 700 }}>Sign-in link for {name}</p>
      <div style={{ display: "flex", gap: ".5rem", flexWrap: "wrap", alignItems: "center" }}>
        <input type="text" readOnly value={url} onFocus={(e) => e.currentTarget.select()}
          style={{ flex: "1 1 22rem", fontFamily: "monospace", fontSize: ".8rem" }} />
        <button type="button" className="btn" onClick={() => {
          navigator.clipboard.writeText(url).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          });
        }}>
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
      <p className="meta" style={{ margin: ".5rem 0 0" }}>
        Send this to {name.split(" ")[0]} however you normally reach them. It works once, expires, and replaces any earlier link for this person.
      </p>
    </div>
  );
}
