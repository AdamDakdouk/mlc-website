import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
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

// Note for callers: the size check below happens after the platform has
// already fully buffered the uploaded file — Next.js 16's
// proxyClientMaxBodySize silently truncates request bodies over its own
// 10MB default rather than rejecting them, so this explicit check is still
// necessary, not redundant. See
// node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/proxyClientMaxBodySize.md
const MAX_REQUEST_SIZE = 10 * 1024 * 1024;

export async function POST(request: NextRequest) {
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

  let photoUrl: string | null = null;
  const photoFile = formData.get("photo");
  if (photoFile instanceof File && photoFile.size > 0) {
    try {
      photoUrl = await validateAndSaveImage(photoFile, "teachers");
    } catch (err) {
      if (err instanceof ImageValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  await connectToDatabase();
  const highestOrderTeacher = await Teacher.findOne().sort({ order: -1 });
  const nextOrder = highestOrderTeacher ? highestOrderTeacher.order + 1 : 0;

  let teacher;
  try {
    teacher = await Teacher.create({
      name: parsed.data.name,
      subjects: parsed.data.subjects,
      qualifications: parsed.data.qualifications,
      experience: parsed.data.experience,
      photoUrl,
      order: nextOrder,
    });
  } catch (err) {
    if (photoUrl) {
      await deleteImageFile(photoUrl);
    }
    throw err;
  }

  return NextResponse.json({ id: teacher._id.toString() }, { status: 201 });
}
