import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Bundle reasoning/*.json with every server-rendered page so they're
  // available at runtime on Vercel (Next file-tracing won't grab them
  // automatically because the path is computed from a runtime hash).
  outputFileTracingIncludes: {
    "/": ["./reasoning/**/*"],
    "/agent/[address]": ["./reasoning/**/*"],
    "/place/[pickId]": ["./reasoning/**/*"],
  },
};

export default nextConfig;
