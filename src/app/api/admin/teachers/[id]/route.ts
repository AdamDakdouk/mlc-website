import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import mongoose from "mongoose";
import { connectToDatabase } from "@/lib/db";
import { Teacher } from "@/models/Teacher";
import { validateAndSaveImage, deleteImageFile, ImageValidationError } from "@/lib/imageUpload";
import { SUBJECTS } from "@/lib/subjects";

const teacherFieldsSchema = z.object({
  name: z.string().min(1, "Name is required").max(200, "Name is too long"),
  subjects: z.array(z.enum(SUBJECTS)).min(1, "At least one subject is required"),
  qualifications: z.string().max(2000, "Qualifications is too long"),
  experience: z.string().max(2000, "Experience is too long"),
});

const MAX_REQUEST_SIZE = 10 * 1024 * 1024;

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid teacher id" }, { status: 400 });
  }

  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_REQUEST_SIZE) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const parsed = teacherFieldsSchema.safeParse({
    name: formData.get("name"),
    subjects: formData.getAll("subjects"),
    qualifications: formData.get("qualifications") ?? "",
    experience: formData.get("experience") ?? "",
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again" },
      { status: 400 },
    );
  }

  await connectToDatabase();
  const existing = await Teacher.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Teacher not found" }, { status: 404 });
  }

  const removePhoto = formData.get("removePhoto") === "true";
  const photoFile = formData.get("photo");

  const oldPhotoUrl = existing.photoUrl;
  let newPhotoUrl = oldPhotoUrl;

  if (photoFile instanceof File && photoFile.size > 0) {
    try {
      newPhotoUrl = await validateAndSaveImage(photoFile, "teachers");
    } catch (err) {
      if (err instanceof ImageValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  } else if (removePhoto) {
    newPhotoUrl = null;
  }

  existing.name = parsed.data.name;
  existing.subjects = parsed.data.subjects;
  existing.qualifications = parsed.data.qualifications;
  existing.experience = parsed.data.experience;
  existing.photoUrl = newPhotoUrl;

  try {
    await existing.save();
  } catch (err) {
    // Save failed — roll back the newly-uploaded file (if any). The old
    // file and DB record are untouched, so no broken reference is ever
    // visible — the record still points at oldPhotoUrl until save succeeds.
    if (newPhotoUrl && newPhotoUrl !== oldPhotoUrl) {
      await deleteImageFile(newPhotoUrl);
    }
    throw err;
  }

  // Only delete the old file once the DB write is confirmed — a crash here
  // leaves an orphaned old file (harmless), never a broken live reference.
  if (oldPhotoUrl && oldPhotoUrl !== newPhotoUrl) {
    await deleteImageFile(oldPhotoUrl);
  }

  return NextResponse.json({ success: true });
}
