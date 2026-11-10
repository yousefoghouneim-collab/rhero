// Builds the RHero brand assets from the official RH Aero Systems artwork
// (brand/source/*.svg): the "RHero" wordmark reuses the R, H, e, r, o letterforms
// of the RH Aero wordmark (the "A" is dropped, "ero" moves left), next to the RH Aero wings.
// Outputs SVGs to src/assets/brand and PNG icons to public/icons.
// Usage: node scripts/gen-brand.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const src = fs.readFileSync(path.join(root, 'brand/source/rhaero-lockup-horizontal.svg'), 'utf8');
const iconSrc = fs.readFileSync(path.join(root, 'brand/source/rhaero-icon.svg'), 'utf8');

function el(id) {
  const m = src.match(new RegExp(`<(path|rect)[^>]*id="${id}"[^>]*/>`));
  if (!m) throw new Error('missing ' + id);
  return m[0].replace(/ data-name="[^"]*"/, '').replace(/ id="[^"]*"/, '').replace(/ fill="[^"]*"/, '');
}
function iconPath(id) {
  const m = iconSrc.match(new RegExp(`<path id="${id}" d="([^"]+)"`));
  if (!m) throw new Error('missing icon ' + id);
  return m[1];
}

// --- palette (from rhaero.com) ---
const NAVY = '#202854';
const NAVY_DEEP = '#080a3c';
const NAVY_WING = '#07275c';
const RED = '#b20709';
const RED_DEEP = '#560a1c';
const RED_ON_DARK = '#f25a5a';

// letters (coordinates of the original 978.869 × 153.412 lockup)
const R = [el('Rechteck_62'), el('Pfad_2113')];
const H = [el('Rechteck_63'), el('Pfad_2114')];
const ERO = [el('Pfad_2110'), el('Pfad_2111'), el('Pfad_2112')];
const SHIFT = -89.2; // close the gap left by the "A"
// wings (original lockup coordinates)
const WINGS = {
  bottom: el('Pfad_2117'),
  bottomShadow: `<g transform="translate(44.732 91.445)">${el('Pfad_2118')}</g>`,
  top: el('Pfad_2135'),
  topShadow: `<g transform="translate(44.732)">${el('Pfad_2136')}</g>`,
};

function wings({ top, topShadow, bottom, bottomShadow }) {
  return `<g fill="${bottom}">${WINGS.bottom}</g><g fill="${bottomShadow}">${WINGS.bottomShadow}</g>` +
         `<g fill="${top}">${WINGS.top}</g><g fill="${topShadow}">${WINGS.topShadow}</g>`;
}
function wordmark(rh, ero) {
  return `<g fill="${rh}">${R.join('')}${H.join('')}</g><g fill="${ero}" transform="translate(${SHIFT} 0)">${ERO.join('')}</g>`;
}

// horizontal logo: wings + RHero  (x 0 … 528.4, y 0 … 153.4)
const W = 545, Hh = 154;
const logoLight = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="RHero">` +
  wings({ top: RED, topShadow: RED_DEEP, bottom: NAVY_WING, bottomShadow: NAVY_DEEP }) + wordmark(NAVY, RED) + `</svg>`;
const logoDark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Hh}" role="img" aria-label="RHero">` +
  wings({ top: '#ffffff', topShadow: 'rgba(255,255,255,.55)', bottom: '#ffffff', bottomShadow: 'rgba(255,255,255,.55)' }) +
  wordmark('#ffffff', RED_ON_DARK) + `</svg>`;
// wordmark only (x 175.3 … 528.4)
const wmLight = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="172 30 360 95" role="img" aria-label="RHero">${wordmark(NAVY, RED)}</svg>`;
const wmDark = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="172 30 360 95" role="img" aria-label="RHero">${wordmark('#ffffff', RED_ON_DARK)}</svg>`;

// square mark from the official 160×160 icon
const ICON = {
  bottom: iconPath('Pfad_21171'),
  bottomShadow: iconPath('Pfad_21181'),
  top: iconPath('Pfad_21351'),
  topShadow: iconPath('Pfad_21361'),
};
function mark({ top, topShadow, bottom, bottomShadow }) {
  return `<path d="${ICON.bottom}" fill="${bottom}"/><path d="${ICON.bottomShadow}" fill="${bottomShadow}"/>` +
         `<path d="${ICON.top}" fill="${top}"/><path d="${ICON.topShadow}" fill="${topShadow}"/>`;
}
const markColor = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">${mark({ top: RED, topShadow: RED_DEEP, bottom: NAVY_WING, bottomShadow: NAVY_DEEP })}</svg>`;
const markWhite = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160">${mark({ top: '#fff', topShadow: 'rgba(255,255,255,.6)', bottom: '#fff', bottomShadow: 'rgba(255,255,255,.6)' })}</svg>`;

// app icon: navy tile, red top wing, white bottom wing (scale = mark size inside the tile)
function appIcon(size, { pad = 0.2, radius = 0 } = {}) {
  const inner = size * (1 - pad * 2);
  const s = inner / 160;
  const off = (size - inner) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2b3572"/><stop offset="1" stop-color="#151a40"/></linearGradient></defs>
  <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/>
  <g transform="translate(${off - inner * 0.02} ${off}) scale(${s})">${mark({ top: '#e3262c', topShadow: '#8e0d1d', bottom: '#ffffff', bottomShadow: '#b9c1dc' })}</g>
</svg>`;
}

const outSvg = path.join(root, 'src/assets/brand');
fs.mkdirSync(outSvg, { recursive: true });
fs.writeFileSync(path.join(outSvg, 'rhero-logo.svg'), logoLight);
fs.writeFileSync(path.join(outSvg, 'rhero-logo-dark.svg'), logoDark);
fs.writeFileSync(path.join(outSvg, 'rhero-wordmark.svg'), wmLight);
fs.writeFileSync(path.join(outSvg, 'rhero-wordmark-dark.svg'), wmDark);
fs.writeFileSync(path.join(outSvg, 'rhero-mark.svg'), markColor);
fs.writeFileSync(path.join(outSvg, 'rhero-mark-white.svg'), markWhite);

const pub = path.join(root, 'public');
fs.mkdirSync(path.join(pub, 'icons'), { recursive: true });
fs.writeFileSync(path.join(pub, 'favicon.svg'), appIcon(64, { pad: 0.14, radius: 14 }));
fs.writeFileSync(path.join(pub, 'icons/rhero-logo.svg'), logoLight);

const browser = await chromium.launch();
const page = await browser.newPage({ deviceScaleFactor: 1 });
async function png(svg, size, file, transparent = false) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${svg.replace('<svg ', `<svg style="display:block;width:${size}px;height:${size}px" `)}</body></html>`);
  await page.screenshot({ path: file, omitBackground: transparent, clip: { x: 0, y: 0, width: size, height: size } });
}
await png(appIcon(512, { pad: 0.2 }), 512, path.join(pub, 'icons/icon-512.png'));
await png(appIcon(192, { pad: 0.2 }), 192, path.join(pub, 'icons/icon-192.png'));
await png(appIcon(512, { pad: 0.27 }), 512, path.join(pub, 'icons/maskable-512.png'));
await png(appIcon(180, { pad: 0.19 }), 180, path.join(pub, 'icons/apple-touch-icon.png'));
await png(appIcon(32, { pad: 0.12, radius: 7 }), 32, path.join(pub, 'icons/favicon-32.png'), true);

// social / share preview 1200×630
await page.setViewportSize({ width: 1200, height: 630 });
await page.setContent(`<html><body style="margin:0">
  <div style="width:1200px;height:630px;background:linear-gradient(135deg,#202854 0%,#151a40 100%);display:flex;flex-direction:column;justify-content:center;padding:0 90px;box-sizing:border-box;font-family:Barlow,Arial,sans-serif;position:relative;overflow:hidden">
    <div style="position:absolute;left:0;right:0;bottom:0;height:10px;background:#b20709"></div>
    <div style="width:560px">${logoDark}</div>
    <div style="color:#dfe3f0;font-size:38px;margin-top:34px;font-weight:500">Office operations for RH Aero Systems</div>
    <div style="color:#9aa3c7;font-size:28px;margin-top:12px">Cleaning rounds · Live pantry &amp; stationery stock · Supply orders</div>
  </div></body></html>`);
await page.screenshot({ path: path.join(pub, 'icons/og-image.png') });

// brand sheet for review
await page.setViewportSize({ width: 1100, height: 760 });
await page.setContent(`<html><body style="margin:0;font-family:sans-serif;display:grid;grid-template-columns:1fr 1fr">
  <div style="padding:30px;background:#fff"><div style="width:420px">${logoLight}</div></div>
  <div style="padding:30px;background:${NAVY}"><div style="width:420px">${logoDark}</div></div>
  <div style="padding:30px;background:#f4f5f9;display:flex;gap:24px;align-items:center">
    <img src="data:image/svg+xml;base64,${Buffer.from(appIcon(512, { pad: 0.2, radius: 112 })).toString('base64')}" width="140">
    <img src="data:image/svg+xml;base64,${Buffer.from(appIcon(512, { pad: 0.2, radius: 112 })).toString('base64')}" width="60">
    <div style="width:120px">${markColor}</div></div>
  <div style="padding:30px;background:#0f1330;display:flex;gap:24px;align-items:center"><div style="width:300px">${wmDark}</div></div>
</body></html>`);
await page.screenshot({ path: path.join(root, 'brand/rhero-brand-sheet.png') });
await browser.close();
console.log('brand assets written');
