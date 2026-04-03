#!/usr/bin/env node

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const SVG_PATH = path.join(__dirname, '..', 'public', 'icons', 'icon-192.svg');
const OUT_DIR = path.join(__dirname, '..', 'public', 'icons');

const STANDARD_SIZES = [48, 72, 96, 128, 144, 192, 384, 512];
const MASKABLE_SIZES = [192, 512];
// Maskable icons need 10% safe-zone padding on each side (80% usable area)
const MASKABLE_PADDING_RATIO = 0.1;

async function main() {
  const svgBuffer = fs.readFileSync(SVG_PATH);

  // Generate standard PNG icons
  for (const size of STANDARD_SIZES) {
    const outPath = path.join(OUT_DIR, `icon-${size}.png`);
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outPath);
    console.log(`Generated ${outPath}`);
  }

  // Generate maskable icons (with padding for safe zone)
  for (const size of MASKABLE_SIZES) {
    const padding = Math.round(size * MASKABLE_PADDING_RATIO);
    const innerSize = size - padding * 2;
    const outPath = path.join(OUT_DIR, `icon-maskable-${size}.png`);

    // Render SVG at inner size, then extend with background color
    const inner = await sharp(svgBuffer)
      .resize(innerSize, innerSize)
      .png()
      .toBuffer();

    await sharp(inner)
      .extend({
        top: padding,
        bottom: padding,
        left: padding,
        right: padding,
        background: { r: 3, g: 7, b: 18, alpha: 1 }, // #030712
      })
      .png()
      .toFile(outPath);

    console.log(`Generated ${outPath} (maskable)`);
  }

  console.log('Done! All icons generated.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
