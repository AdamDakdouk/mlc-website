import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { SessionApplication } from "@/models/SessionApplication";
import { CalendarEvent } from "@/models/CalendarEvent";
import { Teacher } from "@/models/Teacher";
import { sendSessionConfirmationEmail } from "@/lib/mailer";
import { type SessionApplicationStatus } from "@/lib/sessionApplicationStatuses";
import { deletePaymentProofFile } from "@/lib/paymentProofUpload";

// A SessionApplication is created as "Pending" by the public apply route
// and only ever transitions away from it here, once — never back to
// Pending, and never re-transitioned once Verified/Rejected (see the
// existing.status !== "Pending" guard below). Typed against the shared
// status union so a typo here is caught by the compiler.
const UPDATABLE_STATUSES = [
  "Verified",
  "Rejected",
] as const satisfies readonly SessionApplicationStatus[];

const updateFieldsSchema = z.object({
  status: z.enum(UPDATABLE_STATUSES),
});

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid application id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateFieldsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again" },
      { status: 400 },
    );
  }

  await connectToDatabase();
  const existing = await SessionApplication.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  if (existing.status !== "Pending") {
    return NextResponse.json(
      { error: "This application has already been reviewed" },
      { status: 409 },
    );
  }

  if (parsed.data.status === "Rejected") {
    await CalendarEvent.updateOne(
      { _id: existing.sessionId },
      { $inc: { applicantCount: -1 } },
    );
  }

  if (parsed.data.status === "Verified") {
    const session = await CalendarEvent.findById(existing.sessionId);
    const teacher = session?.teacherId ? await Teacher.findById(session.teacherId) : null;
    if (session) {
      try {
        await sendSessionConfirmationEmail({
          to: existing.email,
          recipientName: existing.name,
          sessionTitle: session.title,
          teacherName: teacher?.name ?? "TBD",
          sessionDateTime: session.sessionDateTime!,
          durationMinutes: session.durationMinutes!,
          price: session.price!,
        });
      } catch (err) {
        // Best-effort: email delivery is deferred/sandboxed infrastructure
        // (Mailtrap in dev, no production provider chosen yet) across this
        // whole project — a send failure must never block the actual
        // verification, only get logged.
        console.error("Failed to send session confirmation email:", err);
      }
    }
  }

  existing.status = parsed.data.status;
  await existing.save();

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid application id" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await SessionApplication.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  const { deletedCount } = await SessionApplication.deleteOne({ _id: id });
  await deletePaymentProofFile(existing.paymentProofFilename);

  // applicantCount tracks non-rejected applications. A Rejected one already
  // released its spot when it was rejected; a Pending or Verified one still
  // holds it, so deleting that application frees the spot. deletedCount
  // guards against a concurrent double-delete decrementing twice, and the
  // applicantCount > 0 filter keeps the counter from ever going negative.
  if (deletedCount === 1 && existing.status !== "Rejected") {
    await CalendarEvent.updateOne(
      { _id: existing.sessionId, applicantCount: { $gt: 0 } },
      { $inc: { applicantCount: -1 } },
    );
  }

  return NextResponse.json({ success: true });
}
