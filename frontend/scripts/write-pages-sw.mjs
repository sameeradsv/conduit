// Writes a minimal service worker to public/sw.js for the GitHub Pages build.
// @ducanh2912/next-pwa is disabled on GitHub Pages (its workbox precache
// uses /_next/... paths that break under the /conduit basePath prefix).
// A fetch handler is the only hard requirement for the PWA install prompt.
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

const sw = `const CACHE = "conduit-v2";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", (e) => {
  const { request } = e;
  // Never intercept API calls or non-GET traffic (diary/agent POST must bypass the SW).
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.includes("/api/")) return;

  e.respondWith(
    fetch(request).catch(() =>
      caches.match(request).then(
        (cached) =>
          cached ||
          new Response("Offline", { status: 503, statusText: "Offline" }),
      ),
    ),
  );
});
`;

writeFileSync(join(__dirname, "../public/sw.js"), sw);
console.log("  ✓ public/sw.js (minimal, GitHub Pages)");
