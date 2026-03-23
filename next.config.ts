import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3002",
        "localhost:3000",
        "154.83.158.137:3002",
        "154.83.158.137",
      ],
    },
  },
};

export default nextConfig;
