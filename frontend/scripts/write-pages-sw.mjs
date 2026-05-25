// Writes a minimal service worker to public/sw.js for the GitHub Pages build.
// @ducanh2912/next-pwa is disabled on GitHub Pages (its workbox precache
// uses /_next/... paths that break under the /conduit basePath prefix).
// A fetch handler is the only hard requirement for the PWA install prompt.
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sw = `const CACHE = "conduit-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
`;

writeFileSync(join(__dirname, "../public/sw.js"), sw);
console.log("  ✓ public/sw.js (minimal, GitHub Pages)");
