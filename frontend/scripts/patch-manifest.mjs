// Writes manifest.json with correct start_url/scope for the target deployment.
// GITHUB_PAGES=true → /conduit base; otherwise root.
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const base = process.env.GITHUB_PAGES === "true" ? "/conduit" : "";

const manifest = {
  name: "conduit",
  short_name: "conduit",
  description: "Terminal-style multi-model AI chat",
  display: "standalone",
  orientation: "portrait-primary",
  background_color: "#0e130e",
  theme_color: "#0e130e",
  start_url: `${base}/`,
  scope: `${base}/`,
  icons: [
    {
      src: `${base}/icons/icon-192.png`,
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: `${base}/icons/icon-512.png`,
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
    {
      src: `${base}/icons/icon-maskable-512.png`,
      sizes: "512x512",
      type: "image/png",
      purpose: "maskable",
    },
  ],
};

writeFileSync(
  join(root, "public/manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n",
);
console.log(`  ✓ manifest.json  start_url=${manifest.start_url}`);
