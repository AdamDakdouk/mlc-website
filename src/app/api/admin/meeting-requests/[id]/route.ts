import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { MeetingRequest } from "@/models/MeetingRequest";
import { isRealDateTime, DATETIME_RE } from "@/lib/dateTime";
import { type MeetingRequestStatus } from "@/lib/meetingRequestStatuses";

// MeetingRequest.status is created as "Pending" by the public booking route
// and only ever transitions away from it here — admin can move a request
// to Confirmed or Declined, never back to Pending, so this endpoint's input
// set is deliberately narrower than the model's full status enum. Typed
// against the shared MeetingRequestStatus union so a typo here, or a future
// change to the status set, is caught by the compiler.
const UPDATABLE_STATUSES = [
  "Confirmed",
  "Declined",
] as const satisfies readonly MeetingRequestStatus[];

const updateFieldsSchema = z.object({
  status: z.enum(UPDATABLE_STATUSES),
  confirmedDateTime: z.string().regex(DATETIME_RE, "Invalid date/time").optional(),
});

const MAX_REQUEST_SIZE = 100 * 1024;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid meeting request id" }, { status: 400 });
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

  if (parsed.data.confirmedDateTime && !isRealDateTime(parsed.data.confirmedDateTime)) {
    return NextResponse.json({ error: "Invalid date/time" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await MeetingRequest.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Meeting request not found" }, { status: 404 });
  }

  existing.status = parsed.data.status;

  if (parsed.data.status === "Confirmed") {
    // Confirming without an explicit adjusted time keeps whatever was
    // already confirmed (supports re-confirming after an earlier change
    // without losing it), or falls back to the parent's originally
    // requested time if nothing has been confirmed yet.
    existing.confirmedDateTime = parsed.data.confirmedDateTime
      ? new Date(`${parsed.data.confirmedDateTime}:00.000Z`)
      : (existing.confirmedDateTime ?? existing.requestedDateTime);
  }

  await existing.save();

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid meeting request id" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await MeetingRequest.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Meeting request not found" }, { status: 404 });
  }

  await MeetingRequest.deleteOne({ _id: id });

  return NextResponse.json({ success: true });
}
