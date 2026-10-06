import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  output: "standalone",
  distDir: process.env.NEXT_TEST_DIST_DIR || ".next",
};

export default nextConfig;
