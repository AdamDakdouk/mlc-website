import path from "path";

// Everything the app writes to disk (public images and private resumes /
// payment proofs) lives under one root. In development it defaults to the
// project directory. In production, point UPLOAD_ROOT at the host's
// persistent disk (e.g. /var/data) — anything outside that disk is wiped on
// every deploy. Read at call time, not import time, so it can be set per
// environment (and per test).
export function storageRoot(): string {
  return process.env.UPLOAD_ROOT?.trim() || process.cwd();
}

// Public images (teachers, announcements, achievements), served to visitors
// by src/app/uploads/[folder]/[filename]/route.ts.
export function publicUploadsRoot(): string {
  return path.join(storageRoot(), "public", "uploads");
}

// Private files (resumes, payment proofs) — never served directly, only via
// authenticated admin routes.
export function privateUploadsRoot(kind: "resumes" | "payment-proofs"): string {
  return path.join(storageRoot(), "uploads-private", kind);
}
