import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { TourBooking } from "@/models/TourBooking";
import { isRealDateTime, DATETIME_RE } from "@/lib/dateTime";

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
// bytes — this cap is a sanity guard against abuse, not a real ceiling: a
// request with no Content-Length header (or chunked transfer-encoding)
// skips this check entirely, and request.json() will still fully buffer
// the body into memory before any downstream validation runs. Real
// enforcement needs a reverse-proxy/hosting-level body-size limit,
// deferred until a hosting target is chosen (see project notes). Same
// accepted tradeoff as src/app/api/careers/[id]/apply/route.ts, which is
// more consequential there since it's the only endpoint accepting a file.
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
