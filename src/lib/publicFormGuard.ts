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

// Trusts X-Forwarded-For as-is. This is ONLY safe behind a reverse proxy/CDN
// that OVERWRITES this header with the real client IP before forwarding
// (e.g. Vercel, Cloudflare, or an nginx config with proxy_set_header, not
// proxy_add_header). If this app is ever exposed directly to the internet
// without such a proxy, a client can spoof this header to defeat rate
// limiting entirely. Revisit when the production hosting target is chosen.
export function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
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
