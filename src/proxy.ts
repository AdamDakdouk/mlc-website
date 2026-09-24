import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/jwt";

// Next.js 16 renamed the "middleware" file convention to "proxy" (the
// `middleware` export/name is deprecated — see
// node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md).
// Functionally identical to the old middleware API; only the file and
// export names changed.
export async function proxy(request: NextRequest) {
  const token = request.cookies.get("token")?.value;

  if (!token) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  const payload = await verifyToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/dashboard/:path*"],
};
