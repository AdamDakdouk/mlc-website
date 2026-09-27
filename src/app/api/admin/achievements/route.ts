import { NextRequest, NextResponse } from "next/server";
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

  let photoUrl: string | null = null;
  const photoFile = formData.get("photo");
  if (photoFile instanceof File && photoFile.size > 0) {
    try {
      photoUrl = await validateAndSaveImage(photoFile, "achievements");
    } catch (err) {
      if (err instanceof ImageValidationError) {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
      throw err;
    }
  }

  await connectToDatabase();
  let achievement;
  try {
    achievement = await Achievement.create({
      title: parsed.data.title,
      description: parsed.data.description,
      date,
      photoUrl,
    });
  } catch (err) {
    // Avoid orphaning an already-saved photo file if the DB write fails
    // after a successful upload.
    if (photoUrl) {
      await deleteImageFile(photoUrl);
    }
    throw err;
  }

  return NextResponse.json({ id: achievement._id.toString() }, { status: 201 });
}
