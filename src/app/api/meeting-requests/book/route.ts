import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { MeetingRequest } from "@/models/MeetingRequest";
import { HONEYPOT_FIELD, isHoneypotTripped, rateLimitPublicSubmission } from "@/lib/publicFormGuard";
import { notifyAdmin } from "@/lib/adminNotifications";
import { getPublicOrigin } from "@/lib/siteConfig";

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
  const limited = rateLimitPublicSubmission(request, "meeting-request");
  if (limited) return limited;

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

  // Honeypot tripped: pretend success so the bot learns nothing, save nothing.
  if (isHoneypotTripped((body as Record<string, unknown> | null)?.[HONEYPOT_FIELD])) {
    return NextResponse.json({ id: "000000000000000000000000" }, { status: 201 });
  }

  const parsed = meetingRequestFieldsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again" },
      { status: 400 },
    );
  }

  await connectToDatabase();
  const meetingRequest = await MeetingRequest.create({
    parentName: parsed.data.parentName,
    parentEmail: parsed.data.parentEmail,
    parentPhone: parsed.data.parentPhone,
    parentAddress: parsed.data.parentAddress,
    studentName: parsed.data.studentName,
    studentGrade: parsed.data.studentGrade,
    reason: parsed.data.reason ?? "",
  });

  await notifyAdmin({
    subject: `New meeting request from ${parsed.data.parentName}`,
    replyTo: parsed.data.parentEmail,
    details: [
      ["Parent", parsed.data.parentName],
      ["Email", parsed.data.parentEmail],
      ["Phone", parsed.data.parentPhone],
      ["Address", parsed.data.parentAddress],
      ["Student", parsed.data.studentName],
      ["Grade", parsed.data.studentGrade],
      ["Message", parsed.data.reason ?? ""],
    ],
    adminUrl: `${getPublicOrigin(request.nextUrl.origin)}/admin/dashboard/meeting-requests/${meetingRequest._id.toString()}`,
  });

  return NextResponse.json({ id: meetingRequest._id.toString() }, { status: 201 });
}
