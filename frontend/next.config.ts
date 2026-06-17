import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const isGithubPages = process.env.GITHUB_PAGES === "true";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  fallbacks: { document: "/offline" },
  workboxOptions: {
    // Keep /api/* off the document fallback path; agent/diary POST streams must hit the network.
    navigateFallbackDenylist: [/^\/api\//],
  },
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@shared/cortex"],
  // Expose base path to client components (used by SWRegistrar)
  env: {
    NEXT_PUBLIC_BASE_PATH: isGithubPages ? "/conduit" : "",
  },
  ...(isGithubPages && {
    output: "export",
    basePath: "/conduit",
    assetPrefix: "/conduit/",
    trailingSlash: true,
    images: { unoptimized: true },
  }),
  ...(!isGithubPages && {
    output: "standalone",
    async rewrites() {
      const base = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(/\/$/, "");
      if (!base) return [];
      return [
        {
          source: "/api/:path*",
          destination: `${base}/api/:path*`,
        },
      ];
    },
  }),
};

// Skip the PWA wrapper entirely on GitHub Pages — the workbox precache
// it generates uses /_next/... paths that break under the /conduit basePath.
// A minimal sw.js is written by scripts/write-pages-sw.mjs instead.
export default isGithubPages ? nextConfig : withPWA(nextConfig);
