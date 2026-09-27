import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Achievement } from "@/models/Achievement";
import { validateAndSaveImage, deleteImageFile, ImageValidationError } from "@/lib/imageUpload";
import { isRealCalendarDate } from "@/lib/calendarDate";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const achievementFieldsSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  description: z.string().min(1, "Description is required").max(2000, "Description is too long"),
  date: z.string().regex(DATE_RE, "Invalid date"),
});

// Headroom above imageUpload's 5MB image cap, to account for form field
// overhead and multipart boundaries, while still bounding worst-case memory
// use.
//
// Note: Next.js 16 (via the proxy this route is matched by, see
// src/proxy.ts's config.matcher covering /api/admin/:path*) already buffers
// incoming request bodies up to `proxyClientMaxBodySize`, which defaults to
// 10MB (see
// node_modules/next/dist/docs/01-app/03-api-reference/05-config/01-next-config-js/proxyClientMaxBodySize.md).
// That platform-level buffering is NOT a substitute for this check: on
// overflow it silently truncates the body and lets the request continue
// processing with partial data instead of rejecting it, which would
// otherwise surface here as a confusing 400 from a broken multipart parse
// rather than a clear 413. This explicit check gives callers a well-defined
// "payload too large" response instead.
//
// This only covers the declared-Content-Length path: a chunked
// transfer-encoding request has no Content-Length header and so bypasses
// this check entirely. That gap is bounded, not unbounded, though — Next's
// own proxyClientMaxBodySize buffering (see above) still caps what actually
// reaches this handler at 10MB underneath, even without this guard.
const MAX_REQUEST_SIZE = 10 * 1024 * 1024; // 10MB

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
    return NextResponse.json({ error: "Invalid achievement id" }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const parsed = achievementFieldsSchema.safeParse({
    title: formData.get("title"),
    description: formData.get("description"),
    date: formData.get("date"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Please check the form fields and try again" },
      { status: 400 },
    );
  }

  if (!isRealCalendarDate(parsed.data.date)) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }
  const date = new Date(parsed.data.date);

  await connectToDatabase();
  const existing = await Achievement.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
  }

  const removePhoto = formData.get("removePhoto") === "true";
  const photoFile = formData.get("photo");

  const oldPhotoUrl = existing.photoUrl;
  let newPhotoUrl = oldPhotoUrl;

  if (photoFile instanceof File && photoFile.size > 0) {
    try {
      newPhotoUrl = await validateAndSaveImage(photoFile, "achievements");
    } catch (err) {
      if (err instanceof ImageValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  } else if (removePhoto) {
    newPhotoUrl = null;
  }

  existing.title = parsed.data.title;
  existing.description = parsed.data.description;
  existing.date = date;
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid achievement id" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await Achievement.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Achievement not found" }, { status: 404 });
  }
  const { photoUrl } = existing;

  // Delete the DB record first, then the photo file — same ordering
  // principle as PUT above: commit the authoritative change first, clean up
  // the filesystem after. A crash between these two steps orphans the photo
  // file (harmless), rather than risking a live record pointing at a
  // deleted file.
  await Achievement.deleteOne({ _id: id });

  if (photoUrl) {
    await deleteImageFile(photoUrl);
  }

  return NextResponse.json({ success: true });
}
