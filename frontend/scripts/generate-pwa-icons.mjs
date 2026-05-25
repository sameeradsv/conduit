import { readFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svg = readFileSync(join(root, "public/icons/icon.svg"));

const outDir = join(root, "public/icons");
mkdirSync(outDir, { recursive: true });

// Background colour matches the SVG — used when extending for maskable padding
const BG = "#0e130e";

const sizes = [
  // Favicon sizes
  { name: "favicon-16x16.png",  size: 16  },
  { name: "favicon-32x32.png",  size: 32  },
  // Apple touch icon (no rounded corners — iOS clips it)
  { name: "apple-touch-icon.png", size: 180, square: true },
  // Standard PWA icons
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  // Maskable: symbol occupies centre 80%, outer 10% is safe-zone padding
  { name: "icon-maskable-512.png", size: 512, maskable: true },
];

for (const { name, size, maskable, square } of sizes) {
  let pipeline;

  if (maskable) {
    // Shrink symbol into safe zone, then extend with background colour
    const inner = Math.round(size * 0.8);
    const pad   = Math.round(size * 0.1);
    pipeline = sharp(svg)
      .resize(inner, inner)
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: BG });
  } else if (square) {
    // No rx rounding — host OS (iOS) provides its own mask
    pipeline = sharp(svg).resize(size, size);
  } else {
    pipeline = sharp(svg).resize(size, size);
  }

  await pipeline.png().toFile(join(outDir, name));
  console.log(`  ✓ ${name} (${size}×${size})`);
}

console.log("\nAll PWA icons generated.");
