import type { NextConfig } from "next";

// Dev mode needs 'unsafe-eval' in script-src: React reconstructs
// server-side error stacks via eval() for debugging in development.
// Confirmed via console: without this, `next dev` logs
// "eval() is not supported in this environment ... make sure that
// unsafe-eval is included". Never required in production (neither
// React nor Next.js use eval() there).
const isDev = process.env.NODE_ENV === "development";

function getSecurityHeaders() {
  return [
    { key: "X-Frame-Options", value: "DENY" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value: "camera=(), microphone=(), geolocation=()",
    },
    {
      key: "Content-Security-Policy",
      value: [
        // No explicit connect-src: same-origin fetch calls (e.g. Task 14's
        // fetch("/api/auth/login")) are covered by the default-src 'self'
        // fallback. Add an explicit connect-src entry if a future change
        // needs a cross-origin fetch — it would otherwise be silently blocked.
        "default-src 'self'",
        `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data:",
        "object-src 'none'",
        "base-uri 'self'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join("; ") + ";",
    },
  ];
}

const nextConfig: NextConfig = {
  // jose ships ESM-only; transpile it so Jest (run under next/jest, without
  // --experimental-vm-modules) can require() it from src/lib/jwt.ts's tests.
  transpilePackages: ["jose"],

  async headers() {
    return [
      {
        source: "/:path*",
        headers: getSecurityHeaders(),
      },
    ];
  },
};

export default nextConfig;
