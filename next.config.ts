import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/*": ["./docs/ai/system-prompt.md"],
  },
};

export default nextConfig;
