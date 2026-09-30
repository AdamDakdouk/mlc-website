import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { MeetingRequest } from "@/models/MeetingRequest";
import { type MeetingRequestStatus } from "@/lib/meetingRequestStatuses";

// MeetingRequest.status is created as "Pending" by the public route; admin
// only ever marks it "Contacted" (never back to Pending), so this endpoint's
// input set is deliberately narrower than the model's full status enum.
const UPDATABLE_STATUSES = ["Contacted"] as const satisfies readonly MeetingRequestStatus[];

const updateFieldsSchema = z.object({
  status: z.enum(UPDATABLE_STATUSES),
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

  await connectToDatabase();
  const existing = await MeetingRequest.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Meeting request not found" }, { status: 404 });
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
