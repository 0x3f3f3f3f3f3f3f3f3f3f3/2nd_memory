import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "154.83.158.137",
    "154.83.158.137:3003",
    "localhost",
    "localhost:3003",
    "127.0.0.1",
    "127.0.0.1:3003",
  ],
  experimental: {
    serverActions: {
      allowedOrigins: [
        "localhost:3002",
        "localhost:3000",
        "localhost:3003",
        "154.83.158.137:3002",
        "154.83.158.137",
      ],
    },
  },
};

export default nextConfig;
