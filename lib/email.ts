// Transactional email via Resend.
//
// Sending is always best-effort: a failed email must never break the action
// that triggered it. Every attempt is recorded in `notifications` so there is
// a record of what the program sent and when.
import { supabaseServer, isDemo } from "./supabase/server";

const FROM = process.env.EMAIL_FROM || "Launchpad Mentorship <onboarding@resend.dev>";
const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://launchpad-mentor-app-chad-9864s-projects.vercel.app";

export interface SendResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

interface SendArgs {
  to: string;
  subject: string;
  body: string;          // plain paragraphs, blank line separated
  cta?: { label: string; href: string };
  userId?: string | null; // for the notifications record
  type: string;
}

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !args.to) {
    return { ok: false, skipped: true, error: key ? "No recipient" : "RESEND_API_KEY not set" };
  }

  let result: SendResult;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to: [args.to],
        subject: args.subject,
        html: render(args.body, args.cta),
        text: plain(args.body, args.cta),
      }),
    });
    if (res.ok) result = { ok: true };
    else result = { ok: false, error: `${res.status} ${(await res.text()).slice(0, 200)}` };
  } catch (e) {
    result = { ok: false, error: e instanceof Error ? e.message : "Send failed" };
  }

  await record(args, result);
  return result;
}

async function record(args: SendArgs, result: SendResult) {
  if (isDemo()) return;
  try {
    const sb = await supabaseServer();
    await sb.from("notifications").insert({
      user_id: args.userId ?? null,
      type: args.type,
      channel: "email",
      payload: { to: args.to, subject: args.subject, ok: result.ok, error: result.error ?? null },
      sent_at: result.ok ? new Date().toISOString() : null,
    });
  } catch {
    // Logging must not break sending.
  }
}

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Launchpad brand: orange is a fill, never text on white.
function render(body: string, cta?: { label: string; href: string }) {
  const paras = body.split("\n\n").map((p) => {
    if (p.startsWith("- ")) {
      const items = p.split("\n").map((l) => `<li style="margin:4px 0">${esc(l.replace(/^- /, ""))}</li>`).join("");
      return `<ul style="margin:0 0 16px;padding-left:20px;color:#52413d">${items}</ul>`;
    }
    return `<p style="margin:0 0 16px;color:#52413d;font-size:15px;line-height:1.6">${esc(p)}</p>`;
  }).join("");

  const button = cta
    ? `<p style="margin:24px 0"><a href="${cta.href}" style="background:#ff7a3d;color:#231a14;font-weight:700;text-decoration:none;padding:12px 22px;border-radius:8px;display:inline-block;font-size:15px">${esc(cta.label)}</a></p>`
    : "";

  return `<!doctype html><html><body style="margin:0;background:#faf8f5;padding:28px 16px">
<div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e4ddd4;border-radius:12px;padding:28px 30px;font-family:Helvetica,Arial,sans-serif">
  <div style="font-weight:700;letter-spacing:2px;font-size:13px;color:#352c27;margin-bottom:22px">LAUNCHPAD</div>
  ${paras}${button}
  <hr style="border:none;border-top:1px solid #e4ddd4;margin:26px 0 14px">
  <p style="margin:0;font-size:12px;color:#6b7a85">Launchpad Tech Ventures mentorship program</p>
</div></body></html>`;
}

function plain(body: string, cta?: { label: string; href: string }) {
  return cta ? `${body}\n\n${cta.label}: ${cta.href}` : body;
}

// ===== Templates =====

export async function emailApplicationReceived(to: string, firstName: string) {
  return sendEmail({
    to, type: "application.received",
    subject: "Thanks for offering to mentor",
    body: `${firstName}, thanks for putting your name forward.

Chad reads every application personally. You will hear back within a week, either way. If it is a fit, the next step is a short profile so we can match you well.

Nothing is needed from you in the meantime.`,
  });
}

export async function emailAdminNewApplication(to: string, name: string, appId: string) {
  return sendEmail({
    to, type: "application.admin_alert",
    subject: `New mentor application: ${name}`,
    body: `${name} just applied to mentor.`,
    cta: { label: "Read the application", href: `${SITE}/admin/applicants/${appId}` },
  });
}

export async function emailAccepted(to: string, firstName: string, userId: string | null) {
  return sendEmail({
    to, userId, type: "application.accepted",
    subject: "You are in. Welcome to Launchpad mentoring",
    body: `${firstName}, we would like you to mentor for us. Welcome.

Your account is ready. We will send you a sign-in link separately, and it will ask you to choose a password. The first thing you will see is a short profile: how you like to work, when you are free, and anything you would rather not be the go-to for. It takes about three minutes and it is what we use to make the match.`,
  });
}

export async function emailDeclined(to: string, firstName: string) {
  return sendEmail({
    to, type: "application.declined",
    subject: "About your Launchpad mentor application",
    body: `${firstName}, thank you for offering your time.

We are not able to place you with a founder for this cohort. That is usually about the mix of what our current founders need rather than anything about your experience, and it can change from one cohort to the next.

If you would like us to keep you in mind for a future cohort, just reply and say so.`,
  });
}

export async function emailMatchIntro(args: {
  to: string; userId: string | null; recipientFirst: string; otherName: string;
  otherRole: "mentor" | "founder"; rationale: string; contact: string;
  firstContactOwner: string; deadline: string;
}) {
  const { recipientFirst, otherName, otherRole, rationale, contact, firstContactOwner, deadline } = args;
  return sendEmail({
    to: args.to, userId: args.userId, type: "match.intro",
    subject: `You have been matched with ${otherName}`,
    body: `${recipientFirst}, you are matched with ${otherName}.

Why the two of you: ${rationale}

How to reach them: ${contact}

${firstContactOwner} reaches out first, by ${deadline}. Everything else lives in the app: book the meeting there, and the shared meeting note is where the conversation gets recorded.`,
    cta: { label: otherRole === "mentor" ? "Open your dashboard" : "Open your dashboard", href: `${SITE}/` },
  });
}

export async function emailNoteDue(args: {
  to: string; userId: string; firstName: string; mentorName: string;
  meetingWhen: string; meetingId: string; hoursLeft: number;
}) {
  return sendEmail({
    to: args.to, userId: args.userId, type: "note.due",
    subject: `Your half of the note is due before ${args.meetingWhen}`,
    body: `${args.firstName}, you are meeting ${args.mentorName} on ${args.meetingWhen}.

Your half of the meeting note is due 24 hours beforehand, which is about ${args.hoursLeft} hours from now. ${args.mentorName.split(" ")[0]} reads it before you sit down, so the meeting can start as a conversation instead of a recap.

It takes a few minutes: what moved, what changed your thinking, and where you need help.`,
    cta: { label: "Write your half", href: `${SITE}/note/${args.meetingId}` },
  });
}

export async function emailNoteShared(args: {
  to: string; userId: string; mentorFirst: string; founderName: string;
  meetingWhen: string; meetingId: string;
}) {
  return sendEmail({
    to: args.to, userId: args.userId, type: "note.shared",
    subject: `${args.founderName} sent their note ahead of ${args.meetingWhen}`,
    body: `${args.mentorFirst}, ${args.founderName} has filled in their half of the note for ${args.meetingWhen}.

Worth reading before you sit down. That is the whole point of the deadline.`,
    cta: { label: "Read the note", href: `${SITE}/note/${args.meetingId}` },
  });
}

export async function emailMentorHalfOverdue(args: {
  to: string; userId: string; mentorFirst: string; founderName: string;
  meetingWhen: string; meetingId: string; daysOverdue: number;
}) {
  return sendEmail({
    to: args.to, userId: args.userId, type: "note.mentor_overdue",
    subject: `Finish the note from your meeting with ${args.founderName}`,
    body: `${args.mentorFirst}, your half of the note from ${args.meetingWhen} is still open, ${args.daysOverdue} days on.

Your read, the risks you see, and what you agreed to next. Two minutes, and it closes the record for ${args.founderName.split(" ")[0]}.`,
    cta: { label: "Finish the note", href: `${SITE}/note/${args.meetingId}` },
  });
}

export async function emailNoMeetingBooked(args: {
  to: string; userId: string; firstName: string; otherName: string; daysSince: number;
  // False for a pair that was matched but has never met, which changes what
  // "it has been N days" is counting from.
  everMet: boolean;
}) {
  return sendEmail({
    to: args.to, userId: args.userId, type: "pair.no_meeting",
    subject: `Nothing on the calendar with ${args.otherName}`,
    body: `${args.firstName}, ${args.everMet
      ? `it has been ${args.daysSince} days since you and ${args.otherName} last met, and there is nothing booked.

Getting the next one on the calendar is the single most useful thing either of you can do this week.`
      : `you and ${args.otherName} were matched ${args.daysSince} days ago and the first meeting is not booked yet.

Getting it on the calendar is the single most useful thing either of you can do this week.`}`,
    cta: { label: "Book a meeting", href: `${SITE}/` },
  });
}

export async function emailWeeklyUpdateDue(args: {
  to: string; userId: string; firstName: string; weekLabel: string; filedBefore: boolean;
}) {
  return sendEmail({
    to: args.to, userId: args.userId, type: "weekly.due",
    subject: `Your week, in about two minutes`,
    body: `${args.firstName}, the weekly update for the week of ${args.weekLabel} is still open.

Eleven questions and nine of them are one click.${args.filedBefore ? " Last week's numbers are already in the boxes, so change what moved and leave the rest." : ""}

It is how your mentor sees what happened between meetings, and it is what we read when we decide who needs help. A week where nothing moved is worth filing too.`,
    cta: { label: "File this week", href: `${SITE}/weekly` },
  });
}
