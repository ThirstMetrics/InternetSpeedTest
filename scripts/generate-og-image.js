#!/usr/bin/env node

const sharp = require('sharp');
const path = require('path');

const WIDTH = 1200;
const HEIGHT = 630;

const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#030712"/>
  <g fill="#06b6d4" transform="translate(440, 120) scale(3)">
    <circle cx="120" cy="60" r="21"/>
    <path d="M 120 42 L 126 30 L 123 45 L 132 36 L 126 45 Z"/>
    <ellipse cx="84" cy="78" rx="30" ry="21" transform="rotate(-10 84 78)"/>
    <path d="M 54 72 L 24 60" stroke="#06b6d4" stroke-width="9" stroke-linecap="round"/>
    <path d="M 54 81 L 30 78" stroke="#06b6d4" stroke-width="9" stroke-linecap="round"/>
    <path d="M 60 90 L 36 96" stroke="#06b6d4" stroke-width="9" stroke-linecap="round"/>
    <path d="M 84 96 L 78 120 L 72 120" stroke="#06b6d4" stroke-width="9" stroke-linecap="round" fill="none"/>
    <path d="M 96 96 L 108 114 L 114 114" stroke="#06b6d4" stroke-width="9" stroke-linecap="round" fill="none"/>
    <path d="M 138 60 L 156 57 L 138 66 Z"/>
    <circle cx="126" cy="57" r="4.8" fill="#030712"/>
  </g>
  <text x="600" y="500" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="700" font-size="56" fill="#f9fafb">SpeedTest</text>
  <text x="600" y="560" text-anchor="middle" font-family="system-ui, sans-serif" font-weight="400" font-size="28" fill="#9ca3af">Find Fast Public WiFi Near You</text>
</svg>
`;

sharp(Buffer.from(svg))
  .png()
  .toFile(path.join(__dirname, '..', 'public', 'og-image.png'))
  .then(() => console.log('Generated public/og-image.png'))
  .catch((err) => { console.error(err); process.exit(1); });
