import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: import.meta.dirname,
  },
  async rewrites() {
    return {
      afterFiles: [
        {
          source: "/",
          destination: "https://docs.kvid.ai/",
        },
        {
          source: "/:path*",
          destination: "https://docs.kvid.ai/:path*",
        },
      ],
    };
  },
};

export default nextConfig;
