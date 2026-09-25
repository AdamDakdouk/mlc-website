import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { Announcement } from "@/models/Announcement";
import { validateAndSaveImage, deleteImageFile, ImageValidationError } from "@/lib/imageUpload";

const announcementFieldsSchema = z.object({
  title: z.string().min(1, "Title is required"),
  body: z.string().min(1, "Body is required"),
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

  if (imageFile instanceof File && imageFile.size > 0) {
    let newImageUrl: string;
    try {
      newImageUrl = await validateAndSaveImage(imageFile);
    } catch (err) {
      if (err instanceof ImageValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
    if (existing.imageUrl) {
      await deleteImageFile(existing.imageUrl);
    }
    existing.imageUrl = newImageUrl;
  } else if (removeImage && existing.imageUrl) {
    await deleteImageFile(existing.imageUrl);
    existing.imageUrl = null;
  }

  existing.title = parsed.data.title;
  existing.body = parsed.data.body;
  await existing.save();

  return NextResponse.json({ success: true });
}
