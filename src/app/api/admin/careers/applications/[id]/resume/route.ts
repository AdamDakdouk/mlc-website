import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Application } from "@/models/Application";
import { readResumeFile } from "@/lib/resumeUpload";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid application id" }, { status: 400 });
  }

  await connectToDatabase();
  const application = await Application.findById(id).lean();
  if (!application) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await readResumeFile(application.resumeFilename);
  } catch {
    return NextResponse.json({ error: "Resume file not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": 'attachment; filename="resume.pdf"',
    },
  });
}
