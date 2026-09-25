import { randomUUID } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import path from "path";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

const UPLOAD_DIR = path.join(process.cwd(), "public", "uploads", "announcements");

export class ImageValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImageValidationError";
  }
}

function detectImageType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

// Note for callers: the size check below happens after the platform has
// already fully buffered the uploaded file — it does NOT protect against a
// large-request-body DoS at the network layer; callers must enforce an
// upstream body-size limit. Validation here is magic-bytes-only (confirms
// file format, not structural well-formedness) — do not feed the output
// into an image-decoding/processing step without additional validation.
export async function validateAndSaveImage(file: File): Promise<string> {
  if (file.size > MAX_SIZE_BYTES) {
    throw new ImageValidationError("Image exceeds 5MB limit");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const detectedType = detectImageType(buffer);
  if (!detectedType) {
    throw new ImageValidationError("File must be a JPEG, PNG, or WebP image");
  }

  const ext = ALLOWED_TYPES[detectedType];
  const filename = `${randomUUID()}.${ext}`;

  await mkdir(UPLOAD_DIR, { recursive: true });
  await writeFile(path.join(UPLOAD_DIR, filename), buffer);

  return `/uploads/announcements/${filename}`;
}

export async function deleteImageFile(imageUrl: string): Promise<void> {
  const filename = path.basename(imageUrl);
  if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/.test(filename)) {
    return;
  }
  const filePath = path.join(UPLOAD_DIR, filename);
  try {
    await unlink(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
}
