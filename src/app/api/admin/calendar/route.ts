import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import { CATEGORIES } from "@/lib/calendarCategories";
import { isRealCalendarDate } from "@/lib/calendarDate";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const calendarEventFieldsSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  category: z.enum(CATEGORIES),
  startDate: z.string().regex(DATE_RE, "Invalid start date"),
  endDate: z.string().regex(DATE_RE, "Invalid end date").optional(),
  description: z.string().max(1000, "Description is too long").optional(),
});

// No file upload in this module, so a legitimate body is a few hundred
// bytes — this cap is a sanity guard against abuse, not a real ceiling.
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

  const parsed = calendarEventFieldsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again" },
      { status: 400 },
    );
  }

  if (!isRealCalendarDate(parsed.data.startDate)) {
    return NextResponse.json({ error: "Invalid start date" }, { status: 400 });
  }
  if (parsed.data.endDate && !isRealCalendarDate(parsed.data.endDate)) {
    return NextResponse.json({ error: "Invalid end date" }, { status: 400 });
  }

  const startDate = new Date(parsed.data.startDate);
  const endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : startDate;
  if (endDate < startDate) {
    return NextResponse.json(
      { error: "End date must be on or after start date" },
      { status: 400 },
    );
  }

  await connectToDatabase();
  const event = await CalendarEvent.create({
    title: parsed.data.title,
    category: parsed.data.category,
    startDate,
    endDate,
    description: parsed.data.description ?? "",
  });

  return NextResponse.json({ id: event._id.toString() }, { status: 201 });
}
