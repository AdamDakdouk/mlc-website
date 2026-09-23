import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // jose ships ESM-only; transpile it so Jest (run under next/jest, without
  // --experimental-vm-modules) can require() it from src/lib/jwt.ts's tests.
  transpilePackages: ["jose"],
};

export default nextConfig;
