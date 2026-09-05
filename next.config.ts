import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "21mb",
    },
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
