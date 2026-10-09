import { randomUUID } from "crypto";
import { mkdir, writeFile, unlink, readFile } from "fs/promises";
import path from "path";
import { publicUploadsRoot } from "@/lib/storagePaths";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_FOLDERS = ["announcements", "teachers", "achievements"] as const;
type UploadFolder = (typeof ALLOWED_FOLDERS)[number];

function isValidFolder(value: string): value is UploadFolder {
  return (ALLOWED_FOLDERS as readonly string[]).includes(value);
}

const STORED_FILENAME_RE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

const CONTENT_TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

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
export async function validateAndSaveImage(file: File, folder: UploadFolder): Promise<string> {
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
  const uploadDir = path.join(publicUploadsRoot(), folder);

  await mkdir(uploadDir, { recursive: true });
  // The storage root is chosen at runtime (UPLOAD_ROOT), so the bundler can't
  // statically scope this path and would otherwise trace the whole project
  // into the build output.
  await writeFile(path.join(/*turbopackIgnore: true*/ uploadDir, filename), buffer);

  return `/uploads/${folder}/${filename}`;
}

// Takes only the imageUrl, not an explicit folder: the folder is derived
// from the URL itself so every call site doesn't have to independently
// re-supply a folder name the URL already encodes. That redundancy is
// exactly the kind of drift risk this shape avoids — e.g. a record saved
// under "teachers" but deleted via a copy-pasted call that still says
// "announcements". The derived folder is still validated against the same
// allowlist `validateAndSaveImage` writes use.
export async function deleteImageFile(imageUrl: string): Promise<void> {
  const filename = path.basename(imageUrl);
  if (!STORED_FILENAME_RE.test(filename)) {
    return;
  }
  const folder = path.basename(path.dirname(imageUrl));
  if (!isValidFolder(folder)) {
    return;
  }
  const filePath = path.join(publicUploadsRoot(), folder, filename);
  try {
    await unlink(filePath);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
}

// Reads a previously saved public image for the /uploads route. Both
// segments come straight from the request URL, so each is validated before
// touching the filesystem: the folder against the allowlist, the filename
// against the exact shape validateAndSaveImage generates (UUID + known
// extension), which also rules out any path traversal. Returns null for
// anything invalid or missing so the caller can answer 404 uniformly.
export async function readImageFile(
  folder: string,
  filename: string,
): Promise<{ buffer: Buffer; contentType: string } | null> {
  if (!isValidFolder(folder) || !STORED_FILENAME_RE.test(filename)) {
    return null;
  }
  try {
    const buffer = await readFile(path.join(publicUploadsRoot(), folder, filename));
    const ext = filename.slice(filename.lastIndexOf(".") + 1);
    return { buffer, contentType: CONTENT_TYPE_BY_EXT[ext] };
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw err;
  }
}
