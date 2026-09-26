import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { JobPosting } from "@/models/JobPosting";
import { Application } from "@/models/Application";
import { deleteResumeFile } from "@/lib/resumeUpload";

const jobPostingFieldsSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  description: z.string().min(1, "Description is required").max(5000, "Description is too long"),
  requirements: z.string().max(5000, "Requirements is too long").optional(),
  status: z.enum(["Open", "Closed"]),
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
    return NextResponse.json({ error: "Invalid posting id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = jobPostingFieldsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again" },
      { status: 400 },
    );
  }

  await connectToDatabase();
  const existing = await JobPosting.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Posting not found" }, { status: 404 });
  }

  existing.title = parsed.data.title;
  existing.description = parsed.data.description;
  existing.requirements = parsed.data.requirements ?? "";
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
    return NextResponse.json({ error: "Invalid posting id" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await JobPosting.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Posting not found" }, { status: 404 });
  }

  // Cascade: an Application whose postingId points at nothing is useless,
  // and an orphaned resume file would be undeletable applicant PII with no
  // UI path to ever clean it up. This is why postings normally get closed
  // rather than deleted — delete is for correcting a mistake.
  const applications = await Application.find({ postingId: id });
  // Sequential (not Promise.all) is deliberate: it bounds how many files get
  // deleted before a failure, and a retry is safe since deleteResumeFile is
  // idempotent for already-removed files (ENOENT is swallowed). If this
  // throws, the posting/applications are left intact so the admin can retry.
  for (const application of applications) {
    try {
      await deleteResumeFile(application.resumeFilename);
    } catch (err) {
      console.error(
        `Failed to delete resume file "${application.resumeFilename}" for application ${application._id.toString()}:`,
        err,
      );
      throw err;
    }
  }
  await Application.deleteMany({ postingId: id });
  await JobPosting.deleteOne({ _id: id });

  return NextResponse.json({ success: true });
}
