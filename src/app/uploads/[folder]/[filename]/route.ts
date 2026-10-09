import { NextResponse } from "next/server";
import { readImageFile } from "@/lib/imageUpload";

// Public images are written to disk at runtime (admin uploads), and a
// production `next start` only serves files that existed in `public/` at
// build time — anything uploaded afterwards would 404. This route serves
// them instead, from the same /uploads/<folder>/<file> URLs the database
// already stores. Only the exact filenames validateAndSaveImage generates
// are served (see readImageFile).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ folder: string; filename: string }> },
) {
  const { folder, filename } = await params;

  const image = await readImageFile(folder, filename);
  if (!image) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(image.buffer), {
    headers: {
      "Content-Type": image.contentType,
      // Filenames are random UUIDs that are never reused (a replaced image
      // gets a new name), so a given URL's content never changes.
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
