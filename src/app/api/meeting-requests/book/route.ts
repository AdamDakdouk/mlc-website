import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { MeetingRequest } from "@/models/MeetingRequest";
import { Teacher } from "@/models/Teacher";
import { isRealDateTime, DATETIME_RE } from "@/lib/dateTime";

const meetingRequestFieldsSchema = z.object({
  parentName: z.string().min(1, "Parent name is required").max(200, "Parent name is too long"),
  parentEmail: z
    .string()
    .min(1, "Email is required")
    .max(254, "Email is too long")
    .email("Invalid email address"),
  parentPhone: z.string().min(1, "Phone is required").max(30, "Phone is too long"),
  parentAddress: z.string().min(1, "Address is required").max(200, "Address is too long"),
  studentName: z.string().min(1, "Student name is required").max(200, "Student name is too long"),
  studentGrade: z.string().min(1, "Grade is required").max(50, "Grade is too long"),
  teacherId: z.string().min(1, "Teacher is required"),
  requestedDateTime: z.string().regex(DATETIME_RE, "Invalid date/time"),
  reason: z.string().max(2000, "Reason is too long").optional(),
});

// No file upload in this module, so a legitimate body is a few hundred
// bytes — this cap is a sanity guard against abuse, not a real ceiling: a
// request with no Content-Length header (or chunked transfer-encoding)
// skips this check entirely, and request.json() will still fully buffer
// the body into memory before any downstream validation runs. Real
// enforcement needs a reverse-proxy/hosting-level body-size limit,
// deferred until a hosting target is chosen (see project notes).
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

  const parsed = meetingRequestFieldsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again" },
      { status: 400 },
    );
  }

  if (!mongoose.isValidObjectId(parsed.data.teacherId)) {
    return NextResponse.json({ error: "Invalid teacher" }, { status: 400 });
  }

  if (!isRealDateTime(parsed.data.requestedDateTime)) {
    return NextResponse.json({ error: "Invalid date/time" }, { status: 400 });
  }
  const requestedDateTime = new Date(`${parsed.data.requestedDateTime}:00.000Z`);

  await connectToDatabase();

  const teacher = await Teacher.findById(parsed.data.teacherId);
  if (!teacher) {
    return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
  }

  const meetingRequest = await MeetingRequest.create({
    parentName: parsed.data.parentName,
    parentEmail: parsed.data.parentEmail,
    parentPhone: parsed.data.parentPhone,
    parentAddress: parsed.data.parentAddress,
    studentName: parsed.data.studentName,
    studentGrade: parsed.data.studentGrade,
    teacherId: parsed.data.teacherId,
    reason: parsed.data.reason ?? "",
    requestedDateTime,
  });

  return NextResponse.json({ id: meetingRequest._id.toString() }, { status: 201 });
}
