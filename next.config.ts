import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // 20 MiB PDF cap plus multipart overhead
      bodySizeLimit: "21mb",
    },
  },
};

export default nextConfig;
