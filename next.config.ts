import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";

const nextConfig: NextConfig = {
  async headers() {
    if (!isDev) return [];
    // Development only: never let the browser cache pages, JS, or CSS. This prevents
    // stale bundles from being served after edits (the recurring "I changed it but the
    // browser still shows the old version" problem). No effect on production builds.
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
          { key: "Pragma", value: "no-cache" },
        ],
      },
    ];
  },
};

export default nextConfig;
