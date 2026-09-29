import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import { Teacher } from "@/models/Teacher";
import { CATEGORIES } from "@/lib/calendarCategories";
import { isRealCalendarDate } from "@/lib/calendarDate";
import { isRealDateTime, DATETIME_RE } from "@/lib/dateTime";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const calendarEventFieldsSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(200, "Title is too long"),
    category: z.enum(CATEGORIES),
    startDate: z.string().regex(DATE_RE, "Invalid start date"),
    endDate: z.string().regex(DATE_RE, "Invalid end date").optional(),
    description: z.string().max(1000, "Description is too long").optional(),
    teacherId: z.string().min(1).optional(),
    sessionDateTime: z.string().regex(DATETIME_RE, "Invalid date/time").optional(),
    durationMinutes: z.number().int().min(1).max(480).optional(),
    capacity: z.number().int().min(1).max(500).optional(),
    price: z.number().min(0).max(100000).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.category !== "Session") return;
    if (!data.teacherId) {
      ctx.addIssue({ code: "custom", path: ["teacherId"], message: "Teacher is required" });
    }
    if (!data.sessionDateTime) {
      ctx.addIssue({
        code: "custom",
        path: ["sessionDateTime"],
        message: "Date & time is required",
      });
    }
    if (data.durationMinutes === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["durationMinutes"],
        message: "Duration is required",
      });
    }
    if (data.capacity === undefined) {
      ctx.addIssue({ code: "custom", path: ["capacity"], message: "Capacity is required" });
    }
    if (data.price === undefined) {
      ctx.addIssue({ code: "custom", path: ["price"], message: "Price is required" });
    }
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

  await connectToDatabase();

  let startDate = new Date(parsed.data.startDate);
  let endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : startDate;

  let teacherId: string | undefined;
  let sessionDateTime: Date | undefined;

  if (parsed.data.category === "Session") {
    if (!isRealDateTime(parsed.data.sessionDateTime!)) {
      return NextResponse.json({ error: "Invalid date/time" }, { status: 400 });
    }
    const teacher = await Teacher.findById(parsed.data.teacherId);
    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 400 });
    }
    teacherId = parsed.data.teacherId;
    sessionDateTime = new Date(`${parsed.data.sessionDateTime}:00.000Z`);
    // For grid placement, a Session's date range is just the day it falls
    // on — the calendar grid, monthUtils.ts, and CalendarGrid.tsx need no
    // changes at all, since a Session is a single-day event as far as the
    // grid is concerned.
    startDate = new Date(sessionDateTime.toISOString().slice(0, 10));
    endDate = startDate;
  }

  if (endDate < startDate) {
    return NextResponse.json(
      { error: "End date must be on or after start date" },
      { status: 400 },
    );
  }

  const event = await CalendarEvent.create({
    title: parsed.data.title,
    category: parsed.data.category,
    startDate,
    endDate,
    description: parsed.data.description ?? "",
    ...(parsed.data.category === "Session"
      ? {
          teacherId,
          sessionDateTime,
          durationMinutes: parsed.data.durationMinutes,
          capacity: parsed.data.capacity,
          price: parsed.data.price,
        }
      : {}),
  });

  return NextResponse.json({ id: event._id.toString() }, { status: 201 });
}
