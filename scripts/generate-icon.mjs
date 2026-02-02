/**
 * Generate Pulse app icons from SVG
 * Creates all required sizes for Tauri/Windows
 */

import sharp from 'sharp';
import pngToIco from 'png-to-ico';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = join(__dirname, '..', 'src-tauri', 'icons');

// Pulse icon SVG - ECG heartbeat line on gradient background
const createSvg = (size) => `
<svg width="${size}" height="${size}" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background gradient: Blue to Purple -->
    <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#3B82F6"/>
      <stop offset="50%" style="stop-color:#6366F1"/>
      <stop offset="100%" style="stop-color:#8B5CF6"/>
    </linearGradient>
    
    <!-- Glow effect for the line -->
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="coloredBlur"/>
      <feMerge>
        <feMergeNode in="coloredBlur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
    
    <!-- Subtle shadow -->
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="4" stdDeviation="8" flood-opacity="0.3"/>
    </filter>
  </defs>
  
  <!-- Rounded square background -->
  <rect x="16" y="16" width="480" height="480" rx="96" ry="96" 
        fill="url(#bgGradient)" filter="url(#shadow)"/>
  
  <!-- Subtle inner border -->
  <rect x="24" y="24" width="464" height="464" rx="88" ry="88" 
        fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="2"/>
  
  <!-- ECG Heartbeat line -->
  <polyline 
    points="
      64,280
      140,280
      170,280
      190,320
      210,180
      230,360
      250,140
      270,340
      290,220
      310,280
      340,280
      380,280
      400,240
      420,280
      448,280
    "
    fill="none" 
    stroke="white" 
    stroke-width="20" 
    stroke-linecap="round" 
    stroke-linejoin="round"
    filter="url(#glow)"
  />
  
  <!-- Small pulse dot at end -->
  <circle cx="448" cy="280" r="12" fill="white" opacity="0.9"/>
</svg>
`;

// Icon sizes needed for Tauri
const sizes = [
  { name: '32x32.png', size: 32 },
  { name: '128x128.png', size: 128 },
  { name: '128x128@2x.png', size: 256 },
  { name: 'icon.png', size: 512 },
  // Windows Store logos
  { name: 'Square30x30Logo.png', size: 30 },
  { name: 'Square44x44Logo.png', size: 44 },
  { name: 'Square71x71Logo.png', size: 71 },
  { name: 'Square89x89Logo.png', size: 89 },
  { name: 'Square107x107Logo.png', size: 107 },
  { name: 'Square142x142Logo.png', size: 142 },
  { name: 'Square150x150Logo.png', size: 150 },
  { name: 'Square284x284Logo.png', size: 284 },
  { name: 'Square310x310Logo.png', size: 310 },
  { name: 'StoreLogo.png', size: 50 },
];

async function generateIcons() {
  console.log('Generating Pulse icons...\n');

  // Ensure icons directory exists
  if (!existsSync(ICONS_DIR)) {
    mkdirSync(ICONS_DIR, { recursive: true });
  }

  // Generate PNG icons
  const pngPaths = [];
  for (const { name, size } of sizes) {
    const svg = createSvg(size);
    const outputPath = join(ICONS_DIR, name);
    
    await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toFile(outputPath);
    
    console.log(`  Created: ${name} (${size}x${size})`);
    pngPaths.push({ path: outputPath, size });
  }

  // Generate ICO file (Windows icon with multiple sizes)
  console.log('\nGenerating ICO file...');
  
  // ICO needs specific sizes: 16, 24, 32, 48, 64, 128, 256
  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const icoBuffers = [];
  
  for (const size of icoSizes) {
    const svg = createSvg(size);
    const buffer = await sharp(Buffer.from(svg))
      .resize(size, size)
      .png()
      .toBuffer();
    icoBuffers.push(buffer);
  }
  
  const icoBuffer = await pngToIco(icoBuffers);
  writeFileSync(join(ICONS_DIR, 'icon.ico'), icoBuffer);
  console.log('  Created: icon.ico');

  console.log('\nDone! All icons generated successfully.');
}

generateIcons().catch(console.error);
