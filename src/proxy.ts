import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";

// Next.js 16 renamed the "middleware" file convention to "proxy" (the
// `middleware` export/name is deprecated — see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
// Functionally identical to the old middleware API; only the file and
// export names changed.
export async function proxy(request: NextRequest) {
  const token = request.cookies.get("token")?.value;
  const payload = token ? await verifyToken(token) : null;

  if (!payload) {
    // request.url reflects whatever protocol/host Next believes it received.
    // Behind a reverse proxy, this depends on X-Forwarded-Proto/Host being set
    // correctly — get that wrong and this redirect could leak an internal
    // http:// URL. Revisit when the production hosting target is chosen (see
    // the same caveat in src/app/api/auth/login/route.ts's getClientIp comment).
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/dashboard/:path*"],
};
