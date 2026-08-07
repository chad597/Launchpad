"use client";

// Print is how this page becomes the PDF that gets shared, so the button
// lives on the page rather than in a menu nobody finds.
export function PrintButton() {
  return (
    <button className="btn ghost no-print" onClick={() => window.print()}>
      Print or save as PDF
    </button>
  );
}
