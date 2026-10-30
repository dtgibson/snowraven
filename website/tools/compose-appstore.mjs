// App Store screenshot composer: frames the raw captures for upload.
//
// capture-appstore.mjs photographs the app into appstore/screenshots/raw/. This
// script turns each raw capture into the frame App Store Connect receives: the
// capture as a rounded card on SnowRaven's dark green band (the website's band),
// under the tab's exact name, one muted line saying what the frame shows, and
// the raven mark at the top right. The frames land one folder up, in
// appstore/screenshots/{iphone-6.9,ipad-13,iphone-duo}/, keeping the raw file
// names. The UPLOAD ORDER is FRAMES below, not the number in a file name.
//
//   FAMILY  optional: compose only "iphone", "ipad" or "duo" (default: all three)
//
// Inputs are committed files only (the raws, the raven master SVG) and this
// file's own caption table. Nothing is fetched and no font file is used: the
// captions are set in the system font, SF Pro on the Mac this runs on, the face
// the app itself renders in on iPhone and iPad.
//
// Renderer: Playwright Chromium, one page per frame at a viewport the size of
// the family's canvas and deviceScaleFactor 1, so the CSS box model below IS
// the approved geometry (the `.fr` block of the design mockup, copied verbatim
// with the output overrides marked). Each raw is first reduced with sharp to the
// card's exact width, so Chromium draws it pixel for pixel rather than
// resampling it. sharp then flattens every frame to opaque RGB and verifies it.
//
// Fails loudly, and writes nothing for that family, when:
//   - a raw capture is missing or is not the family's canvas size;
//   - the table holds fewer than 1 or more than 10 frames (App Store Connect's
//     limit per set) or names one file twice;
//   - a caption line is wider than its box, measured in the renderer (a cut-off
//     tab name is the one thing a search-result thumbnail cannot survive);
//   - the card is not drawn at whole pixels and at the reduced raw's own size;
//   - an output is not exactly the canvas size, is not 3-channel, carries alpha,
//     or does not read the band color in its flat lower corner (a color-managed
//     render would shift every pixel);
//   - the output folder holds a PNG the table does not name. A set is replaced
//     whole and in order (DECISIONS.md, v1.0.4), so a stray file would be
//     uploaded into it.
//
// Determinism: same machine, same inputs, same bytes. Across macOS versions the
// system font's metrics can move by a pixel, so the test pins geometry, size
// and opacity rather than a byte hash.
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';

export const RAW_ROOT = fileURLToPath(new URL('../../appstore/screenshots/raw/', import.meta.url));
export const OUT_ROOT = fileURLToPath(new URL('../../appstore/screenshots/', import.meta.url));
const GLYPH_SVG = fileURLToPath(new URL('../../frontend/src/assets/snowraven-bird-glyph.svg', import.meta.url));

// App Store Connect takes 1 to 10 screenshots per set.
export const MAX_FRAMES = 10;

// The three upload sets. `canvas` is both the raw capture's size and the
// composed frame's: capture-appstore.mjs's FAMILIES `px`, which App Store
// Connect accepts as is. `cls` picks the family's geometry in FRAME_CSS.
export const FAMILIES = Object.freeze([
  Object.freeze({ key: 'iphone', dir: 'iphone-6.9', canvas: Object.freeze({ w: 1320, h: 2868 }), cls: 'fr--iphone' }),
  Object.freeze({ key: 'ipad', dir: 'ipad-13', canvas: Object.freeze({ w: 2064, h: 2752 }), cls: 'fr--ipad' }),
  Object.freeze({ key: 'duo', dir: 'iphone-duo', canvas: Object.freeze({ w: 2007, h: 2853 }), cls: 'fr--duo' }),
]);

// The frames, in UPLOAD ORDER, shared by all three families. The display line
// is the tab's name exactly as TAB_LABELS (frontend/src/lib/tabLayout.ts)
// spells it; the second line says what the frame shows. Published copy: a
// change here is a change to the App Store listing and waits for the user's
// yes, like appstore/LISTING.md, which records the same table.
export const FRAMES = Object.freeze([
  Object.freeze({ file: '01-map-explorer.png', tab: 'Map Explorer', desc: 'Your sightings and nearby hotspots on a map' }),
  Object.freeze({ file: '02-statistics.png', tab: 'Statistics', desc: 'Life list totals, growth, and milestones' }),
  Object.freeze({ file: '04-calendar.png', tab: 'Calendar', desc: 'Each day shaded by species, checklists, media, etc.' }),
  Object.freeze({ file: '05-species-detail.png', tab: 'Species Detail', desc: 'Your whole history with one bird' }),
  Object.freeze({ file: '03-weather-tide.png', tab: 'Weather', desc: 'A weather and tide summary for a checklist' }),
  Object.freeze({ file: '06-breeding-codes.png', tab: 'Breeding Codes', desc: 'Breeding evidence by species and code' }),
]);

// The band. #0c1f17, #9fb3a7, #59d499 and the white are website/styles.css's
// band values. Two are derived and used only here (pipeline decision D2):
// --band-top is the band lifted one step for the gradient, and --band-border
// is the website's --band-border (12% white) flattened over #0c1f17 so the
// hairline is a flat fill. If the website's band changes, these change with it.
export const BAND = '#0c1f17';

// The `.fr` block of the approved mockup, verbatim, then the output overrides.
const FRAME_CSS = `
  :root {
    --page: #F9FAFB;
    --accent: #277448;
    --band: ${BAND};
    --band-top: #132c20;
    --band-text: #FFFFFF;
    --band-muted: #9fb3a7;
    --band-accent: #59d499;
    --band-border: #293A33;
    --font: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, sans-serif;
  }
  * { box-sizing: border-box; }
  html { font-family: var(--font); -webkit-text-size-adjust: 100%; }

  .fr { position: relative; container-type: inline-size; aspect-ratio: var(--fw) / var(--fh); overflow: hidden; border-radius: 2.4%; background: linear-gradient(180deg, var(--band-top) 0%, var(--band) 55%, var(--band) 100%); --u: calc(100cqw / var(--fw)); cursor: pointer; margin: 0; }
  .fr--iphone { --fw: 1320; --fh: 2868; --inset: 120; --top: 128; --d: 96; --dlh: 112; --s: 44; --slh: 58; --g1: 12; --g2: 72; --gl: 104; --r: 36; --b: 2; }
  .fr--ipad   { --fw: 2064; --fh: 2752; --inset: 192; --top: 124; --d: 104; --dlh: 120; --s: 48; --slh: 62; --g1: 12; --g2: 68; --gl: 112; --r: 40; --b: 2; }
  .fr--duo    { --fw: 2007; --fh: 2853; --inset: 192; --top: 128; --d: 120; --dlh: 136; --s: 50; --slh: 64; --g1: 12; --g2: 72; --gl: 124; --r: 40; --b: 2; }
  .fr-cap { position: absolute; left: calc(var(--inset) * var(--u)); top: calc(var(--top) * var(--u)); width: calc((var(--fw) - 2 * var(--inset)) * var(--u)); }
  .fr-tab { font-size: calc(var(--d) * var(--u)); line-height: calc(var(--dlh) * var(--u)); font-weight: 700; letter-spacing: -0.02em; color: var(--band-text); white-space: nowrap; padding-right: calc((var(--gl) + 40) * var(--u)); }
  .fr-desc { font-size: calc(var(--s) * var(--u)); line-height: calc(var(--slh) * var(--u)); font-weight: 500; color: var(--band-muted); white-space: nowrap; margin-top: calc(var(--g1) * var(--u)); }
  .fr-glyph { position: absolute; top: calc((var(--top) + 6) * var(--u)); right: calc(var(--inset) * var(--u)); width: calc(var(--gl) * var(--u)); height: calc(var(--gl) * var(--u)); color: var(--band-accent); fill: currentColor; }
  .fr-card { position: absolute; left: calc(var(--inset) * var(--u)); top: calc((var(--top) + var(--dlh) + var(--g1) + var(--slh) + var(--g2)) * var(--u)); width: calc((var(--fw) - 2 * var(--inset)) * var(--u)); border-radius: calc(var(--r) * var(--u)); overflow: hidden; box-shadow: 0 0 0 calc(var(--b) * var(--u)) var(--band-border); background: var(--page); }
  .fr-card img { display: block; width: 100%; height: auto; }

  /* Output overrides. The store rounds a frame's corners itself, so the PNG is
     a full opaque rectangle; the mockup's 2.4% radius only simulated that. */
  html, body { margin: 0; background: var(--band); }
  .fr { border-radius: 0; cursor: default; }
`;

const escapeHtml = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let glyphCache = null;
/** The raven path, read from the committed master SVG and used as is: one path,
 *  its own fill rule, recolored by the frame's single fill (never redrawn). */
export function ravenPath(file = GLYPH_SVG) {
  if (glyphCache && glyphCache.file === file) return glyphCache.path;
  const svg = readFileSync(file, 'utf8');
  const paths = [...svg.matchAll(/<path\b[^>]*>/g)].map(m => m[0]);
  if (paths.length !== 1) throw new Error(`${file}: expected exactly one <path>, found ${paths.length}`);
  const d = paths[0].match(/\sd="([^"]+)"/)?.[1];
  const viewBox = svg.match(/<svg\b[^>]*\sviewBox="([^"]+)"/)?.[1];
  if (!d || viewBox !== '0 0 512 512') throw new Error(`${file}: expected a d attribute and viewBox "0 0 512 512"`);
  glyphCache = { file, path: d };
  return d;
}

function frameHtml(fam, frame, imgSrc) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><style>${FRAME_CSS}</style></head><body>
<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><symbol id="raven" viewBox="0 0 512 512"><path fill-rule="evenodd" clip-rule="evenodd" d="${ravenPath()}"/></symbol></svg>
<figure class="fr ${fam.cls}" style="width: ${fam.canvas.w}px">
<div class="fr-cap"><div class="fr-tab">${escapeHtml(frame.tab)}</div><div class="fr-desc">${escapeHtml(frame.desc)}</div></div>
<svg class="fr-glyph" aria-hidden="true"><use href="#raven"/></svg>
<div class="fr-card"><img alt="" src="${imgSrc}"></div>
</figure></body></html>`;
}

/** Everything the renderer reports about one frame. Runs IN THE PAGE. */
function measureFrame() {
  const line = (el) => {
    const cs = getComputedStyle(el);
    const range = document.createRange();
    range.selectNodeContents(el);
    return {
      text: range.getBoundingClientRect().width,
      box: el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
    };
  };
  const card = document.querySelector('.fr-card').getBoundingClientRect();
  const img = document.querySelector('.fr-card img');
  const ir = img.getBoundingClientRect();
  return {
    tab: line(document.querySelector('.fr-tab')),
    desc: line(document.querySelector('.fr-desc')),
    card: { x: card.x, y: card.y, w: card.width },
    img: { w: ir.width, h: ir.height, nw: img.naturalWidth, nh: img.naturalHeight },
  };
}

/** Refuse a table App Store Connect would refuse, or that names a file twice. */
export function checkTable(frames) {
  if (!Array.isArray(frames) || frames.length < 1 || frames.length > MAX_FRAMES) {
    throw new Error(`the frame table holds ${frames?.length ?? 0} frames; App Store Connect takes 1 to ${MAX_FRAMES} per set`);
  }
  const seen = new Set();
  for (const f of frames) {
    if (seen.has(f.file)) throw new Error(`the frame table names ${f.file} twice`);
    seen.add(f.file);
  }
}

/** Every raw the table names exists, is a regular file, and is the canvas size. */
export async function checkRaws(fam, frames, rawRoot = RAW_ROOT) {
  const problems = [];
  for (const { file } of frames) {
    const path = join(rawRoot, fam.dir, file);
    let st;
    try { st = statSync(path); } catch { problems.push(`${fam.dir}/${file} is missing`); continue; }
    if (!st.isFile()) { problems.push(`${fam.dir}/${file} is not a regular file`); continue; }
    const m = await sharp(path).metadata();
    if (m.width !== fam.canvas.w || m.height !== fam.canvas.h) {
      problems.push(`${fam.dir}/${file} is ${m.width}x${m.height}, expected ${fam.canvas.w}x${fam.canvas.h}`);
    }
  }
  if (problems.length) throw new Error(`raw captures refused:\n  ${problems.join('\n  ')}`);
}

/** An output PNG is exactly the canvas, opaque RGB, and reads the band color in
 *  its flat lower-left corner. Returns its metadata. */
export async function checkFrame(fam, input, label) {
  const m = await sharp(input).metadata();
  const problems = [];
  if (m.format !== 'png') problems.push(`format ${m.format}, expected png`);
  if (m.width !== fam.canvas.w || m.height !== fam.canvas.h) problems.push(`${m.width}x${m.height}, expected ${fam.canvas.w}x${fam.canvas.h}`);
  if (m.channels !== 3) problems.push(`${m.channels} channels, expected 3`);
  if (m.hasAlpha) problems.push('carries an alpha channel');
  if (!problems.length) {
    const px = await sharp(input).extract({ left: 4, top: fam.canvas.h - 5, width: 1, height: 1 }).raw().toBuffer();
    const hex = '#' + [...px.subarray(0, 3)].map(v => v.toString(16).padStart(2, '0')).join('');
    if (hex !== BAND.toLowerCase()) problems.push(`the band reads ${hex} in the lower-left corner, expected ${BAND}`);
  }
  if (problems.length) throw new Error(`${label}: ${problems.join('; ')}`);
  return m;
}

/** The platform font Chromium drew the tab name in, for the run's log. */
async function captionFont(page) {
  const cdp = await page.context().newCDPSession(page);
  try {
    await cdp.send('DOM.enable');
    await cdp.send('CSS.enable');
    const { root } = await cdp.send('DOM.getDocument');
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '.fr-tab' });
    const { fonts } = await cdp.send('CSS.getPlatformFontsForNode', { nodeId });
    return fonts.map(f => f.familyName).join(', ');
  } finally {
    await cdp.detach();
  }
}

/**
 * Compose one family's frames and write them to `outRoot/<fam.dir>/`. Validates
 * the table and the raws before rendering, measures every caption and the card
 * in the renderer, verifies every output, and writes only when the whole family
 * passes. `rawRoot`, `outRoot` and `frames` exist for the tests.
 */
export async function composeFamily(browser, fam, { frames = FRAMES, rawRoot = RAW_ROOT, outRoot = OUT_ROOT, log = () => {} } = {}) {
  checkTable(frames);
  await checkRaws(fam, frames, rawRoot);

  const ctx = await browser.newContext({ viewport: { width: fam.canvas.w, height: fam.canvas.h }, deviceScaleFactor: 1 });
  const rendered = [];
  let font = '';
  try {
    const page = await ctx.newPage();
    const load = async (html) => {
      await page.setContent(html, { waitUntil: 'load' });
      await page.evaluate(() => document.fonts.ready);
    };

    // The card's width comes from the stylesheet, so the raw is reduced to it
    // once per family and Chromium never resamples the capture.
    await load(frameHtml(fam, frames[0], 'data:,'));
    const cardW = await page.$eval('.fr-card', el => el.getBoundingClientRect().width);
    if (!Number.isInteger(cardW) || cardW < 1 || cardW > fam.canvas.w) throw new Error(`${fam.dir}: card width ${cardW} is not a whole pixel count inside the canvas`);

    for (const frame of frames) {
      const label = `${fam.dir}/${frame.file}`;
      const card = await sharp(join(rawRoot, fam.dir, frame.file))
        .resize({ width: cardW, fit: 'inside', withoutEnlargement: true })
        .png()
        .toBuffer();
      await load(frameHtml(fam, frame, `data:image/png;base64,${card.toString('base64')}`));
      await page.$eval('.fr-card img', img => img.decode());
      if (!font) font = await captionFont(page);

      const m = await page.evaluate(measureFrame);
      if (m.tab.text > m.tab.box) {
        throw new Error(`${label}: the tab name "${frame.tab}" is ${m.tab.text.toFixed(1)}px wide, wider than its ${m.tab.box}px box`);
      }
      if (m.desc.text > m.desc.box) {
        throw new Error(`${label}: the second line "${frame.desc}" is ${m.desc.text.toFixed(1)}px wide, wider than its ${m.desc.box}px box`);
      }
      const whole = [m.card.x, m.card.y, m.card.w, m.img.w, m.img.h].every(Number.isInteger);
      if (!whole || m.img.w !== m.img.nw || m.img.h !== m.img.nh || m.card.w !== cardW) {
        throw new Error(`${label}: the card is not drawn at whole pixels at the reduced capture's own size (${JSON.stringify(m)})`);
      }

      const shot = await page.screenshot({ type: 'png', animations: 'disabled', caret: 'hide' });
      const png = await sharp(shot)
        .flatten({ background: BAND })
        .removeAlpha()
        .png({ compressionLevel: 9, palette: false })
        .toBuffer();
      await checkFrame(fam, png, label);
      rendered.push({ frame, png, caption: { tab: m.tab, desc: m.desc }, card: { x: m.card.x, y: m.card.y, w: m.img.w, h: m.img.h } });
    }
  } finally {
    await ctx.close();
  }

  // A PNG in the output folder that the table does not name would be uploaded
  // into the set, so refuse rather than write beside it.
  const outDir = join(outRoot, fam.dir);
  mkdirSync(outDir, { recursive: true });
  const names = new Set(frames.map(f => f.file));
  const strays = readdirSync(outDir).filter(f => /\.png$/i.test(f) && !names.has(f));
  if (strays.length) throw new Error(`${fam.dir}: the output folder holds PNGs the frame table does not name: ${strays.join(', ')}`);

  for (const r of rendered) writeFileSync(join(outDir, r.frame.file), r.png);
  for (const r of rendered) await checkFrame(fam, join(outDir, r.frame.file), `${fam.dir}/${r.frame.file} as written`);
  log(`OK ${fam.dir}: ${rendered.length} frames at ${fam.canvas.w}x${fam.canvas.h}, RGB, no alpha; captions in ${font}`);
  return { font, frames: rendered.map(({ frame, caption, card }) => ({ file: frame.file, caption, card })) };
}

/** Launch the composer's browser. sRGB is forced so no display profile can
 *  color-manage the render (checkFrame reads the band back exactly). */
export function launchComposer() {
  return chromium.launch({ headless: true, args: ['--force-color-profile=srgb', '--hide-scrollbars'] });
}

async function main() {
  const only = process.env.FAMILY || '';
  const families = FAMILIES.filter(f => !only || f.key === only);
  if (!families.length) throw new Error(`FAMILY=${only} names no family (iphone, ipad, duo)`);
  const browser = await launchComposer();
  const failures = [];
  try {
    for (const fam of families) {
      try {
        await composeFamily(browser, fam, { log: console.log });
      } catch (e) {
        failures.push(e.message);
        console.error(`FAIL ${fam.dir}: ${e.message}`);
      }
    }
  } finally {
    await browser.close();
  }
  if (failures.length) {
    console.error(`COMPOSE FAILED (${failures.length} of ${families.length} families)`);
    process.exitCode = 1;
    return;
  }
  console.log(`APP STORE COMPOSE DONE. Upload order: ${FRAMES.map(f => f.file).join(', ')}. Review every frame before uploading.`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
