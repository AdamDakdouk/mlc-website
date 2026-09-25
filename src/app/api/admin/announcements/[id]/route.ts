import { NextRequest, NextResponse } from "next/server";
import mongoose from "mongoose";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Announcement } from "@/models/Announcement";
import { validateAndSaveImage, deleteImageFile, ImageValidationError } from "@/lib/imageUpload";

const announcementFieldsSchema = z.object({
  title: z.string().min(1, "Title is required").max(200, "Title is too long"),
  body: z.string().min(1, "Body is required").max(5000, "Body is too long"),
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
    return NextResponse.json({ error: "Invalid announcement id" }, { status: 400 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const parsed = announcementFieldsSchema.safeParse({
    title: formData.get("title"),
    body: formData.get("body"),
  });

  if (!parsed.success) {
    return NextResponse.json({ error: "Title and body are required" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await Announcement.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
  }

  const removeImage = formData.get("removeImage") === "true";
  const imageFile = formData.get("image");

  const oldImageUrl = existing.imageUrl;
  let newImageUrl = oldImageUrl;

  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      newImageUrl = await validateAndSaveImage(imageFile);
    } catch (err) {
      if (err instanceof ImageValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  } else if (removeImage) {
    newImageUrl = null;
  }

  existing.title = parsed.data.title;
  existing.body = parsed.data.body;
  existing.imageUrl = newImageUrl;

  try {
    await existing.save();
  } catch (err) {
    // Save failed — roll back the newly-uploaded file (if any) so we don't
    // leak it. The old file and DB record are untouched, so no broken
    // reference is ever visible — the record still points at oldImageUrl
    // until save actually succeeds.
    if (newImageUrl && newImageUrl !== oldImageUrl) {
      await deleteImageFile(newImageUrl);
    }
    throw err;
  }

  // Only delete the old file once the DB write is confirmed — a crash here
  // leaves an orphaned old file (harmless, same accepted tradeoff as the
  // create route), never a broken live reference.
  if (oldImageUrl && oldImageUrl !== newImageUrl) {
    await deleteImageFile(oldImageUrl);
  }

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  if (!mongoose.isValidObjectId(id)) {
    return NextResponse.json({ error: "Invalid announcement id" }, { status: 400 });
  }

  await connectToDatabase();
  const existing = await Announcement.findById(id);
  if (!existing) {
    return NextResponse.json({ error: "Announcement not found" }, { status: 404 });
  }

  const { imageUrl } = existing;

  // Delete the DB record first, then the image file — same ordering
  // principle as PUT above: commit the authoritative change first, clean up
  // the filesystem after. If the process dies between these two steps, the
  // image file is orphaned (harmless — nothing references it any more,
  // since the record is already gone). Deleting the file first would risk
  // the opposite: a crash or failure in `deleteOne` after the file is gone
  // would leave a live DB record pointing at a now-missing image, the same
  // broken-reference class of bug Task 5 fixed for updates.
  await Announcement.deleteOne({ _id: id });

  if (imageUrl) {
    await deleteImageFile(imageUrl);
  }

  return NextResponse.json({ success: true });
}
