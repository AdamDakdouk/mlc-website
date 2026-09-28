import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { TourBooking } from "@/models/TourBooking";
import { isRealDateTime } from "@/lib/dateTime";

const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;

const bookingFieldsSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  email: z
    .string()
    .min(1, "Email is required")
    .max(254, "Email is too long")
    .email("Invalid email address"),
  phone: z.string().min(1, "Phone is required").max(30, "Phone is too long"),
  numberOfVisitors: z
    .number()
    .int("Number of visitors must be a whole number")
    .min(1, "At least 1 visitor is required")
    .max(50, "Too many visitors"),
  requestedDateTime: z.string().regex(DATETIME_RE, "Invalid date/time"),
  notes: z.string().max(2000, "Notes is too long").optional(),
});

// No file upload in this module, so a legitimate body is a few hundred
// bytes — this cap is a sanity guard against abuse, not a real ceiling
// (see src/app/api/careers/[id]/apply/route.ts for the fuller caveat about
// why a Content-Length-based check like this can be bypassed entirely by
// omitting the header or using chunked transfer-encoding — the same
// accepted tradeoff applies here).
const MAX_REQUEST_SIZE = 100 * 1024;

export async function POST(request: NextRequest) {
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bookingFieldsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again" },
      { status: 400 },
    );
  }

  if (!isRealDateTime(parsed.data.requestedDateTime)) {
    return NextResponse.json({ error: "Invalid date/time" }, { status: 400 });
  }
  const requestedDateTime = new Date(`${parsed.data.requestedDateTime}:00.000Z`);

  await connectToDatabase();
  const booking = await TourBooking.create({
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    numberOfVisitors: parsed.data.numberOfVisitors,
    notes: parsed.data.notes ?? "",
    requestedDateTime,
  });

  return NextResponse.json({ id: booking._id.toString() }, { status: 201 });
}
