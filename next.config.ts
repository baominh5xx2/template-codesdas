import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Browser harness only: live dev must not share the release build's .next.
  ...(process.env.CHAT_E2E_APP === "live"
    ? { distDir: `.next-e2e-${process.env.CHAT_E2E_APP}` } : {}),
};

export default nextConfig;
