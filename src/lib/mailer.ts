import nodemailer from "nodemailer";
import { SITE_ADDRESS } from "@/lib/siteContact";

// Lazily created so tests that mock this module never need real SMTP env
// vars, and so a missing env var only breaks the code path that actually
// sends mail, not every import of this file.
let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT),
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
  }
  return transporter;
}

export interface SessionConfirmationEmailParams {
  to: string;
  recipientName: string;
  sessionTitle: string;
  teacherName: string;
  sessionDateTime: Date;
  durationMinutes: number;
  price: number;
}

export async function sendSessionConfirmationEmail(
  params: SessionConfirmationEmailParams,
): Promise<void> {
  await getTransporter().sendMail({
    from: '"Modernistic Learning Community" <no-reply@mlc.edu.lb>',
    to: params.to,
    subject: `You're confirmed: ${params.sessionTitle}`,
    text: [
      `Hi ${params.recipientName},`,
      "",
      `Your payment has been verified and your spot in "${params.sessionTitle}" is confirmed.`,
      "",
      `Teacher: ${params.teacherName}`,
      `Date & time: ${params.sessionDateTime.toLocaleString("en-US", { timeZone: "UTC", dateStyle: "full", timeStyle: "short" })}`,
      `Duration: ${params.durationMinutes} minutes`,
      `Price paid: $${params.price}`,
      `Location: ${SITE_ADDRESS}`,
      "",
      "See you there!",
      "Modernistic Learning Community",
    ].join("\n"),
  });
}
