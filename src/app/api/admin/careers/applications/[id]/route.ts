import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Application } from "@/models/Application";
import { deleteResumeFile } from "@/lib/resumeUpload";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid application id" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await Application.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Application not found" }, { status: 404 });
  }

  await Application.deleteOne({ _id: id });
  await deleteResumeFile(existing.resumeFilename);

  return NextResponse.json({ success: true });
}
