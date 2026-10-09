import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "@/lib/rateLimit";

// Name of the hidden decoy field on every public form. Humans never see or
// fill it; naive bots fill every input they find. Deliberately bland so it
// doesn't advertise itself as a trap.
export const HONEYPOT_FIELD = "website";

// 10 submissions (valid or not) per IP per hour, per form. Generous enough
// for several families sharing one school/home connection, tight enough to
// stop a script from filling session seats or flooding the admin inbox.
const SUBMISSION_LIMIT = { max: 10, windowMs: 60 * 60 * 1000 };

// Behind a reverse proxy the real client IP comes from X-Forwarded-For, but
// that header is only trustworthy for the entries the proxy itself appended:
// a client can send its own value, which then sits at the FRONT of the list.
// Set TRUSTED_PROXY_HOPS to the number of trusted proxies in front of the
// app and the IP is taken that many entries from the right, where the
// proxies wrote it (1 = the last entry). Check the right number on the real
// host (see docs/deployment.md) — too high or too low is wrong either way.
//
// Unset keeps the older behaviour of trusting the first entry. That is only
// safe if the host overwrites the header, and is NOT safe if the app is ever
// reachable without a proxy that does so.
export function getClientIp(request: NextRequest): string {
  const header = request.headers.get("x-forwarded-for");
  const entries = header
    ?.split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (!entries || entries.length === 0) return "unknown";

  const hops = Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "", 10);
  if (Number.isInteger(hops) && hops >= 1) {
    return entries[Math.max(0, entries.length - hops)];
  }
  return entries[0];
}

// Returns a 429 response when this IP has used up its submissions for the
// given form, otherwise null. Call before reading the body.
export function rateLimitPublicSubmission(
  request: NextRequest,
  scope: string,
): NextResponse | null {
  const result = checkRateLimit(`${scope}:${getClientIp(request)}`, SUBMISSION_LIMIT);
  if (result.allowed) return null;
  return NextResponse.json(
    { error: "Too many submissions. Please try again later." },
    { status: 429 },
  );
}

export function isHoneypotTripped(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "";
}
