import { SignJWT, jwtVerify } from "jose";
import { env } from "@/lib/env";

const secretKey = new TextEncoder().encode(env.JWT_SECRET);
const ALG = "HS256";
const EXPIRY = "2h";

export interface TokenPayload {
  sub: string;
  role: "admin";
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setExpirationTime(EXPIRY)
    .sign(secretKey);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    if (typeof payload.sub !== "string" || payload.role !== "admin") {
      return null;
    }
    return { sub: payload.sub, role: "admin" };
  } catch {
    return null;
  }
}
