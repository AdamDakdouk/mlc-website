import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { JobPosting } from "@/models/JobPosting";
import { Application } from "@/models/Application";
import { validateAndSaveResume, deleteResumeFile, ResumeValidationError } from "@/lib/resumeUpload";
import { HONEYPOT_FIELD, isHoneypotTripped, rateLimitPublicSubmission } from "@/lib/publicFormGuard";
import { notifyAdmin } from "@/lib/adminNotifications";
import { getPublicOrigin } from "@/lib/siteConfig";

const applicationFieldsSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  email: z
    .string()
    .min(1, "Email is required")
    .max(254, "Email is too long")
    .email("Invalid email address"),
  phone: z.string().min(1, "Phone is required").max(30, "Phone is too long"),
  coverNote: z.string().max(2000, "Cover note is too long").optional(),
});

// The only unauthenticated write endpoint in the app. The cap covers a
// resume (up to 5MB, enforced again inside validateAndSaveResume) plus
// form-field overhead — not the same constant as the admin JSON routes'
// 100KB text-only cap.
const MAX_REQUEST_SIZE = 6 * 1024 * 1024;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // This check is a sanity guard, not a real ceiling: a request with no
  // Content-Length header (or chunked transfer-encoding) skips it entirely,
  // and request.formData() will still fully buffer the body into memory
  // before any downstream validation runs. This is the same accepted
  // tradeoff documented in src/lib/imageUpload.ts's validateAndSaveImage —
  // real enforcement needs a reverse-proxy/hosting-level body-size limit,
  // deferred until a hosting target is chosen (see project notes). This is
  // more consequential here than elsewhere since this is the app's only
  // unauthenticated write endpoint.
  const limited = rateLimitPublicSubmission(request, "careers-apply");
  if (limited) return limited;

  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Posting not found" }, { status: 404 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  // Honeypot tripped: pretend success so the bot learns nothing, save nothing
  // (and, for sessions, reserve no seat).
  if (isHoneypotTripped(formData.get(HONEYPOT_FIELD))) {
    return NextResponse.json({ id: "000000000000000000000000" }, { status: 201 });
  }

  const parsed = applicationFieldsSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    phone: formData.get("phone"),
    coverNote: formData.get("coverNote") ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again" },
      { status: 400 },
    );
  }

  const resumeFile = formData.get("resume");
  if (!(resumeFile instanceof File) || resumeFile.size === 0) {
    return NextResponse.json({ error: "A resume file is required" }, { status: 400 });
  }

  await connectToDatabase();
  const posting = await JobPosting.findById(id);
  if (!posting || posting.status !== "Open") {
    return NextResponse.json({ error: "Posting not found" }, { status: 404 });
  }

  let resumeFilename: string;
  try {
    resumeFilename = await validateAndSaveResume(resumeFile);
  } catch (err) {
    if (err instanceof ResumeValidationError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }

  try {
    await Application.create({
      postingId: id,
      name: parsed.data.name,
      email: parsed.data.email,
      phone: parsed.data.phone,
      resumeFilename,
      coverNote: parsed.data.coverNote ?? "",
    });
  } catch (err) {
    await deleteResumeFile(resumeFilename);
    throw err;
  }

  await notifyAdmin({
    subject: `New job application: ${posting.title}`,
    replyTo: parsed.data.email,
    details: [
      ["Position", posting.title],
      ["Name", parsed.data.name],
      ["Email", parsed.data.email],
      ["Phone", parsed.data.phone],
      ["Cover note", parsed.data.coverNote ?? ""],
    ],
    adminUrl: `${getPublicOrigin(request.nextUrl.origin)}/admin/dashboard/careers/${id}/applications`,
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
