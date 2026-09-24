import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { connectToDatabase } from "@/lib/db";
import { User } from "@/models/User";
import { verifyPassword } from "@/lib/password";
import { signToken } from "@/lib/jwt";
import { checkRateLimit } from "@/lib/rateLimit";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const RATE_LIMIT = { max: 5, windowMs: 15 * 60 * 1000 };
const COOKIE_MAX_AGE_SECONDS = 2 * 60 * 60;

function getClientIp(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rateLimit = checkRateLimit(`login:${ip}`, RATE_LIMIT);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Too many login attempts. Try again later." },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid email or password format" }, { status: 400 });
  }

  await connectToDatabase();
  const user = await User.findOne({ email: parsed.data.email });
  if (!user) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  // verifyPassword can throw (not just return false) for malformed hash inputs.
  // A user's passwordHash should always be a valid bcrypt hash in practice, but
  // we defensively treat any verification failure — thrown or returned false —
  // as an invalid login rather than letting a 500/stack trace leak from this
  // endpoint.
  let validPassword: boolean;
  try {
    validPassword = await verifyPassword(parsed.data.password, user.passwordHash);
  } catch {
    validPassword = false;
  }

  if (!validPassword) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
  }

  user.lastLoginAt = new Date();
  await user.save();

  const token = await signToken({ sub: user.email, role: "admin" });

  const response = NextResponse.json({ success: true });
  response.cookies.set("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
  });

  return response;
}
