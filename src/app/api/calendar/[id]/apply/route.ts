import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import { SessionApplication } from "@/models/SessionApplication";
import {
  validateAndSavePaymentProof,
  deletePaymentProofFile,
  PaymentProofValidationError,
} from "@/lib/paymentProofUpload";

const applicationFieldsSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  email: z
    .string()
    .min(1, "Email is required")
    .max(254, "Email is too long")
    .email("Invalid email address"),
  phone: z.string().min(1, "Phone is required").max(30, "Phone is too long"),
  address: z.string().min(1, "Address is required").max(200, "Address is too long"),
});

// The cap covers a payment-proof image (up to 5MB, enforced again inside
// validateAndSavePaymentProof) plus form-field overhead — same reasoning as
// src/app/api/careers/[id]/apply/route.ts's MAX_REQUEST_SIZE, this is the
// app's third unauthenticated public write endpoint and this check is a
// sanity guard, not a real ceiling: a request with no Content-Length header
// skips it entirely. Real enforcement needs a reverse-proxy/hosting-level
// body-size limit, deferred until a hosting target is chosen.
const MAX_REQUEST_SIZE = 6 * 1024 * 1024;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const parsed = applicationFieldsSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    address: formData.get("address"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again" },
      { status: 400 },
    );
  }

  const proofFile = formData.get("paymentProof");
  if (!(proofFile instanceof File) || proofFile.size === 0) {
    return NextResponse.json({ error: "A payment proof image is required" }, { status: 400 });
  }

  await connectToDatabase();
  const session = await CalendarEvent.findById(id);
  if (!session || session.category !== "Session") {
    return NextResponse.json({ error: "Session not found" }, { status: 404 });
  }

  if (session.sessionDateTime!.getTime() <= Date.now()) {
    return NextResponse.json({ error: "This session's applications are closed" }, { status: 409 });
  }

  // Atomic capacity reservation: MongoDB evaluates the filter (including
  // $expr) and applies the $inc as a single atomic per-document operation,
  // so two requests racing for the last spot can't both succeed — one of
  // them simply won't match this filter and reservedSession comes back
  // null. This is the one place in this feature where a plain
  // check-then-write race would produce a real bug (overselling seats),
  // not a cosmetic one, so it gets this treatment instead of the
  // accepted-tradeoff treatment used elsewhere in this codebase (e.g. the
  // Teacher reorder endpoint's cosmetic order-tie race).
  const reservedSession = await CalendarEvent.findOneAndUpdate(
    { _id: id, category: "Session", $expr: { $lt: ["$applicantCount", "$capacity"] } },
    { $inc: { applicantCount: 1 } },
  );
  if (!reservedSession) {
    return NextResponse.json({ error: "This session is full" }, { status: 409 });
  }

  let proofFilename: string;
  try {
    proofFilename = await validateAndSavePaymentProof(proofFile);
  } catch (err) {
    await CalendarEvent.updateOne({ _id: id }, { $inc: { applicantCount: -1 } });
    if (err instanceof PaymentProofValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  try {
    const application = await SessionApplication.create({
      sessionId: id,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      address: parsed.data.address,
      paymentProofFilename: proofFilename,
    });
    return NextResponse.json({ id: application._id.toString() }, { status: 201 });
  } catch (err) {
    await CalendarEvent.updateOne({ _id: id }, { $inc: { applicantCount: -1 } });
    await deletePaymentProofFile(proofFilename);
    throw err;
  }
}
