"use client";
import { useEffect } from "react";

// NEXT_PUBLIC_BASE_PATH is set in next.config.ts env block at build time.
// It is "/conduit" for GitHub Pages and "" for local/standalone builds.
// Only registers manually when non-empty — the PWA plugin handles local builds.
const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function SWRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator) || !BASE) return;
    navigator.serviceWorker
      .register(`${BASE}/sw.js`, { scope: `${BASE}/` })
      .catch(() => {});
  }, []);
  return null;
}
