import { randomUUID } from "crypto";
import { mkdir, writeFile, unlink, readFile } from "fs/promises";
import path from "path";

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

// Deliberately outside `public/` — see src/lib/imageUpload.ts for the
// sibling pattern used for public images. A resume contains applicant PII
// and must only ever be reachable through the authenticated admin download
// route, never as a static file Next.js would otherwise serve directly.
const PRIVATE_ROOT = path.join(process.cwd(), "uploads-private", "resumes");

const FILENAME_RE = /^[0-9a-f-]{36}\.pdf$/;

export class ResumeValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResumeValidationError";
  }
}

function isPdf(buffer: Buffer): boolean {
  return buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-";
}

export async function validateAndSaveResume(file: File): Promise<string> {
  if (file.size > MAX_SIZE_BYTES) {
    throw new ResumeValidationError("Resume exceeds 5MB limit");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!isPdf(buffer)) {
    throw new ResumeValidationError("Resume must be a PDF file");
  }

  const filename = `${randomUUID()}.pdf`;
  await mkdir(PRIVATE_ROOT, { recursive: true });
  await writeFile(path.join(PRIVATE_ROOT, filename), buffer);

  return filename;
}

export async function readResumeFile(filename: string): Promise<Buffer> {
  if (!FILENAME_RE.test(filename)) {
    throw new ResumeValidationError("Invalid resume filename");
  }
  return readFile(path.join(PRIVATE_ROOT, filename));
}

export async function deleteResumeFile(filename: string): Promise<void> {
  if (!FILENAME_RE.test(filename)) {
    return;
  }
  try {
    await unlink(path.join(PRIVATE_ROOT, filename));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
}
