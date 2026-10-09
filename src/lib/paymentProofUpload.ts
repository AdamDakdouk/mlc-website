import { randomUUID } from "crypto";
import { mkdir, writeFile, unlink, readFile } from "fs/promises";
import path from "path";
import { privateUploadsRoot } from "@/lib/storagePaths";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

// Deliberately outside `public/` — same reasoning as src/lib/resumeUpload.ts:
// a payment screenshot is at least as sensitive as a resume and must only
// ever be reachable through the authenticated admin download route.

const FILENAME_RE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

export class PaymentProofValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PaymentProofValidationError";
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

export async function validateAndSavePaymentProof(file: File): Promise<string> {
  if (file.size > MAX_SIZE_BYTES) {
    throw new PaymentProofValidationError("Payment proof exceeds 5MB limit");
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  const detectedType = detectImageType(buffer);
  if (!detectedType) {
    throw new PaymentProofValidationError("Payment proof must be a JPEG, PNG, or WebP image");
  }

  const ext = ALLOWED_TYPES[detectedType];
  const filename = `${randomUUID()}.${ext}`;

  await mkdir(privateUploadsRoot("payment-proofs"), { recursive: true });
  // The storage root is chosen at runtime (UPLOAD_ROOT), so the bundler can't
  // statically scope this path and would otherwise trace the whole project
  // into the build output.
  await writeFile(path.join(/*turbopackIgnore: true*/ privateUploadsRoot("payment-proofs"), filename), buffer);

  return filename;
}

export async function readPaymentProofFile(filename: string): Promise<Buffer> {
  if (!FILENAME_RE.test(filename)) {
    throw new PaymentProofValidationError("Invalid payment proof filename");
  }
  return readFile(path.join(privateUploadsRoot("payment-proofs"), filename));
}

export async function deletePaymentProofFile(filename: string): Promise<void> {
  if (!FILENAME_RE.test(filename)) {
    return;
  }
  try {
    await unlink(path.join(privateUploadsRoot("payment-proofs"), filename));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      throw err;
    }
  }
}
