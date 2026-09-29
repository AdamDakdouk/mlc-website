import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { CalendarEvent } from "@/models/CalendarEvent";
import { Teacher } from "@/models/Teacher";
import { SessionApplication } from "@/models/SessionApplication";
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
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
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

  if (
    !isRealCalendarDate(parsed.data.startDate) ||
    (parsed.data.endDate && !isRealCalendarDate(parsed.data.endDate))
  ) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await CalendarEvent.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  let startDate = new Date(parsed.data.startDate);
  let endDate = parsed.data.endDate ? new Date(parsed.data.endDate) : startDate;

  if (parsed.data.category === "Session") {
    if (!isRealDateTime(parsed.data.sessionDateTime!)) {
      return NextResponse.json({ error: "Invalid date/time" }, { status: 400 });
    }
    if (!mongoose.isValidObjectId(parsed.data.teacherId)) {
      return NextResponse.json({ error: "Invalid teacher" }, { status: 400 });
    }
    const teacher = await Teacher.findById(parsed.data.teacherId);
    if (!teacher) {
      return NextResponse.json({ error: "Teacher not found" }, { status: 400 });
    }
    const sessionDateTime = new Date(`${parsed.data.sessionDateTime}:00.000Z`);
    startDate = new Date(sessionDateTime.toISOString().slice(0, 10));
    endDate = startDate;

    existing.teacherId = new mongoose.Types.ObjectId(parsed.data.teacherId);
    existing.sessionDateTime = sessionDateTime;
    existing.durationMinutes = parsed.data.durationMinutes;
    existing.capacity = parsed.data.capacity;
    existing.price = parsed.data.price;
  } else {
    // Switching away from Session clears the now-meaningless session
    // fields rather than leaving stale data hanging off the document.
    existing.teacherId = undefined;
    existing.sessionDateTime = undefined;
    existing.durationMinutes = undefined;
    existing.capacity = undefined;
    existing.price = undefined;
  }

  if (endDate < startDate) {
    return NextResponse.json(
      { error: "End date must be on or after start date" },
      { status: 400 },
    );
  }

  existing.title = parsed.data.title;
  existing.category = parsed.data.category;
  existing.startDate = startDate;
  existing.endDate = endDate;
  existing.description = parsed.data.description ?? "";
  await existing.save();

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid event id" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await CalendarEvent.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Event not found" }, { status: 404 });
  }

  const hasApplications = await SessionApplication.exists({ sessionId: id });
  if (hasApplications) {
    return NextResponse.json(
      { error: "Cannot delete a session with existing applications" },
      { status: 409 },
    );
  }

  await CalendarEvent.deleteOne({ _id: id });

  return NextResponse.json({ success: true });
}
