import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const base = process.env.GITHUB_PAGES === "true" ? "/conduit" : "";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "conduit",
    short_name: "conduit",
    description: "Terminal-style multi-model AI chat",
    start_url: base + "/",
    scope: base + "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: "#0e130e",
    theme_color: "#0e130e",
    icons: [
      {
        src: base + "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: base + "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: base + "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
