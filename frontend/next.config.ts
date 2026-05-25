import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

const isGithubPages = process.env.GITHUB_PAGES === "true";

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  fallbacks: { document: "/offline" },
  ...(isGithubPages && { scope: "/conduit/", sw: "sw.js" }),
});

const nextConfig: NextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@shared/cortex"],
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
      return [
        {
          source: "/api/:path*",
          destination: `${process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000"}/api/:path*`,
        },
      ];
    },
  }),
};

export default withPWA(nextConfig);
