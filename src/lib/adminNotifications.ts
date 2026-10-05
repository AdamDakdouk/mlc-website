import { after } from "next/server";
import { sendAdminNotificationEmail } from "@/lib/mailer";
import { SITE_EMAIL } from "@/lib/siteContact";

export interface AdminNotification {
  subject: string;
  // Label/value rows rendered as "Label: value" lines in the email body.
  details: Array<[label: string, value: string]>;
  // Absolute URL of the admin page where this submission can be handled.
  adminUrl: string;
  // Applicant's email, so the admin can reply straight from their mail client.
  replyTo?: string;
}

// Where alerts go. Set ADMIN_NOTIFY_EMAIL to route them elsewhere; until
// then they go to the public site address.
function getRecipient(): string {
  return process.env.ADMIN_NOTIFY_EMAIL?.trim() || SITE_EMAIL;
}

function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

function buildText(notification: AdminNotification): string {
  return [
    ...notification.details.map(([label, value]) => `${label}: ${value || "—"}`),
    "",
    `Review in the admin dashboard: ${notification.adminUrl}`,
  ].join("\n");
}

// Best-effort alert that someone submitted a public form. A failure here
// must never fail or delay the visitor's submission, so it is logged and
// swallowed; and it runs via after() so the response goes out first. With
// no SMTP_HOST configured (tests, fresh checkouts) it does nothing.
//
// Resolves once the send has finished — except under after(), where the
// caller is deliberately not made to wait.
export function notifyAdmin(notification: AdminNotification): Promise<void> {
  if (!process.env.SMTP_HOST) return Promise.resolve();

  const send = async () => {
    try {
      await sendAdminNotificationEmail({
        to: getRecipient(),
        subject: singleLine(notification.subject),
        text: buildText(notification),
        replyTo: notification.replyTo,
      });
    } catch (err) {
      console.error("Failed to send admin notification email:", err);
    }
  };

  try {
    after(send);
    return Promise.resolve();
  } catch {
    // after() throws outside a Next.js request scope (e.g. unit tests).
    return send();
  }
}
