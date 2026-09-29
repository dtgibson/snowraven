// Shared Playwright helpers for the two screenshot capture scripts
// (capture.mjs → website shots, capture-appstore.mjs → App Store sets).
// Extracted verbatim from capture.mjs so both consumers drive the app the
// same way; the only change is parameterization (the browser instance and
// the deviceScaleFactor are arguments instead of module state).

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Chromium flags for headless WebGL (the MapLibre maps render through
// SwiftShader) plus hidden scrollbars so captures are clean.
export const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'];

// New context + page with the app theme pre-seeded (the sr-theme localStorage
// key is read by the app's anti-flash script before first paint) and the two
// species-link marks served from their committed copies (see loadSiteMarks below).
// The marks are loaded BEFORE the context exists, so a missing copy throws
// without leaving a context open.
export async function makePage(browser, theme, vp, deviceScaleFactor = 2) {
  const marks = loadSiteMarks();
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor });
  await ctx.addInitScript((t) => { try { localStorage.setItem('sr-theme', t); } catch (e) {} }, theme);
  await installSiteMarks(ctx, marks);
  const p = await ctx.newPage();
  p.setDefaultTimeout(30000);
  return { ctx, p };
}

// ---- the eBird and Birds of the World marks: served locally, never requested ----
//
// Every species name the app draws carries two 14px marks (SpeciesLinks.tsx):
// the eBird and Birds of the World favicons, loaded as cross-origin <img>
// elements from exactly the two URLs in SITE_MARKS. A mark whose load fails is
// answered with a bundled lucide glyph (a Globe, a SquareLibrary) in the same
// slot, which is right in the app and wrong in a published screenshot.
//
// THE CAPTURE DOES NOT ASK FOR THEM, AND MUST NOT TRY (screenshot-tool-ebird-icon).
// ebird.org runs Anubis, whose `headless-chrome` rule denies the HeadlessChrome
// user agent: /favicon.ico answers with an HTML "Access Denied" page, Chromium
// blocks it, and every eBird mark photographed as the Globe. That is bot
// protection Cornell deployed on purpose, and this repo does not get around
// Cornell's protection without permission (DECISIONS.md, the v0.5.76 Macaulay
// bot-check entry, restated 2026-09-25). So the capture does NOT set a normal
// Chrome user agent, does not run headed, and requests nothing from either
// site. It serves copies committed beside this file, fetched once by a plain
// request that identified itself truthfully (curl's default user agent), which
// eBird answered with its icon: the user's decision of 2026-09-28, recorded
// with each file's source in marks/PROVENANCE.md.
//
// HOW: an init script, NOT a route. It rewrites exactly those two URLs to data:
// URLs of the committed copies at both places an <img> can receive a src:
// Element.prototype.setAttribute('src') and the HTMLImageElement.prototype.src
// setter. React 19 uses both, and patching only the attribute was measured to
// leave marks unsubstituted. The browser therefore never issues a request for
// either icon. A fulfilling ROUTE cannot do this job: with any route registered
// on a context, cross-origin <img> loads die before the handler sees them (see
// installProvenanceRoutes). An init script is not a route, so it also works on
// the Statistics contexts beside the escapee stub.
//
// WHERE: website/tools/marks/, committed, one file per site (SITE_MARKS). Only
// these capture scripts read them; nothing under website/ is part of the app's
// Vite or Tauri build. The capture refuses to start if either is missing or is
// not an image. The file name mirrors the source URL and the content is
// sniffed (eBird's favicon.ico is in fact a PNG), so an HTML page saved in its
// place, such as a bot filter's refusal, is refused rather than served.
//
// Every frame is then checked by assertMarksInFrame, so a mark that still falls
// back (a reverted substitution, a changed URL in the app, a broken copy) fails
// the capture instead of being photographed.
const MARKS_DIR = fileURLToPath(new URL('./marks/', import.meta.url));
export const SITE_MARKS = Object.freeze([
  Object.freeze({ site: 'eBird', url: 'https://ebird.org/favicon.ico', file: 'ebird-favicon.ico' }),
  Object.freeze({ site: 'Birds of the World', url: 'https://birdsoftheworld.org/favicon.ico', file: 'birdsoftheworld-favicon.ico' }),
]);
// A site icon is a few KB. The bound refuses the wrong file, not a big icon.
const MARK_MAX_BYTES = 1024 * 1024;

// The image formats a browser saves a favicon as, by signature. Anything else is
// refused rather than handed to the page as an "image".
function imageMimeOf(bytes) {
  const ascii = (from, to) => bytes.subarray(from, to).toString('latin1');
  if (bytes.length >= 4 && bytes[0] === 0 && bytes[1] === 0 && bytes[2] === 1 && bytes[3] === 0) return 'image/x-icon';
  if (bytes.length >= 8 && ascii(0, 8) === '\x89PNG\r\n\x1a\n') return 'image/png';
  if (bytes.length >= 6 && (ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a')) return 'image/gif';
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 12 && ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'image/webp';
  return null;
}

const marksCache = new Map();

/**
 * Read the two committed mark copies and return `{ dir, byUrl }`, where `byUrl`
 * maps each site's favicon URL to a data: URL of its copy. Cached per
 * directory. THROWS, naming every problem, when a copy is missing, not a
 * regular file, empty or implausibly large, or not an image. `dir` exists for
 * the tests; the capture scripts use the default.
 */
export function loadSiteMarks(dir = MARKS_DIR) {
  if (marksCache.has(dir)) return marksCache.get(dir);
  const byUrl = {};
  const problems = [];
  for (const { url, file } of SITE_MARKS) {
    const path = join(dir, file);
    let bytes;
    try {
      const st = statSync(path);
      if (!st.isFile()) { problems.push(`${path} is not a regular file`); continue; }
      if (st.size === 0 || st.size > MARK_MAX_BYTES) {
        problems.push(`${path} is ${st.size} bytes, which is not a site icon`);
        continue;
      }
      bytes = readFileSync(path);
    } catch (e) {
      if (e.code === 'ENOENT') { problems.push(`${path} is missing`); continue; }
      throw e;
    }
    const mime = imageMimeOf(bytes);
    if (!mime) {
      const html = /^\s*</.test(bytes.subarray(0, 64).toString('latin1'));
      problems.push(`${path} is not an image (${html
        ? 'it is an HTML page, not the icon'
        : 'no ICO, PNG, GIF, JPEG or WebP signature'})`);
      continue;
    }
    byUrl[url] = `data:${mime};base64,${bytes.toString('base64')}`;
  }
  if (problems.length) {
    throw new Error([
      'Refusing to capture: the eBird and Birds of the World marks are served from the copies committed in website/tools/marks/, and the capture never requests them itself.',
      ...problems.map(pr => `  - ${pr}`),
      `Restore them from git (git checkout -- website/tools/marks/); ${join(dir, 'PROVENANCE.md')} says where each came from.`,
    ].join('\n'));
  }
  const marks = Object.freeze({ dir, byUrl: Object.freeze(byUrl) });
  marksCache.set(dir, marks);
  return marks;
}

/** Serve `marks.byUrl` in every page of `ctx` through an init script (never a
 *  route; see the note above). Exact URL match only; every other src passes
 *  through untouched. */
export async function installSiteMarks(ctx, marks) {
  await ctx.addInitScript((byUrl) => {
    const swap = (v) => (typeof v === 'string' && Object.prototype.hasOwnProperty.call(byUrl, v) ? byUrl[v] : v);
    const setAttribute = Element.prototype.setAttribute;
    Element.prototype.setAttribute = function (name, value) {
      const isSrc = this instanceof HTMLImageElement && String(name).toLowerCase() === 'src';
      return setAttribute.call(this, name, isSrc ? swap(value) : value);
    };
    const src = Object.getOwnPropertyDescriptor(HTMLImageElement.prototype, 'src');
    Object.defineProperty(HTMLImageElement.prototype, 'src', {
      configurable: true,
      enumerable: src.enumerable,
      get: src.get,
      set(value) { src.set.call(this, swap(value)); },
    });
  }, marks.byUrl);
}

/** A mark in frame that would photograph as anything but its site icon. The
 *  capture scripts treat it as a failure of the whole run. */
export class MarksInFrameError extends Error {
  constructor(message) { super(message); this.name = 'MarksInFrameError'; }
}

// Runs IN THE PAGE (serialized by p.evaluate), so it must stay self-contained.
// A slot counts as "in frame" when some part of it is visible inside `clip`
// (viewport coordinates; null means the whole viewport) after every clipping
// ancestor, so a row scrolled out of a table does not count and one peeking in
// at the edge does. Hidden tab panels (display: none) have no box and never
// count.
function inspectMarks(clip) {
  const frame = clip || { x: 0, y: 0, width: innerWidth, height: innerHeight };
  const out = { checked: 0, pending: [], bad: [] };
  for (const slot of document.querySelectorAll('.sr-favicon-slot')) {
    if (!slot.checkVisibility({ visibilityProperty: true })) continue;
    const r = slot.getBoundingClientRect();
    let l = Math.max(r.left, frame.x, 0);
    let t = Math.max(r.top, frame.y, 0);
    let rr = Math.min(r.right, frame.x + frame.width, innerWidth);
    let b = Math.min(r.bottom, frame.y + frame.height, innerHeight);
    for (let el = slot.parentElement; el && el !== document.documentElement; el = el.parentElement) {
      const cs = getComputedStyle(el);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
        const a = el.getBoundingClientRect();
        l = Math.max(l, a.left + el.clientLeft);
        t = Math.max(t, a.top + el.clientTop);
        rr = Math.min(rr, a.left + el.clientLeft + el.clientWidth);
        b = Math.min(b, a.top + el.clientTop + el.clientHeight);
      }
      if (cs.position === 'fixed') break; // positioned against the viewport from here up
    }
    if (rr <= l || b <= t) continue;
    out.checked++;
    const label = slot.closest('a')?.getAttribute('aria-label') || 'a species mark';
    const img = slot.querySelector('img');
    if (slot.querySelector('svg')) out.bad.push(`${label}: fallback glyph`);
    else if (!img) out.bad.push(`${label}: no image`);
    else if (!img.complete) out.pending.push(label);
    else if (!img.naturalWidth) out.bad.push(`${label}: image is 0px wide`);
    else if (!img.currentSrc.startsWith('data:')) out.bad.push(`${label}: loaded from ${img.currentSrc}, not from the committed copy`);
  }
  return out;
}

/**
 * FAIL THE SHOT, before it is written, when any species mark inside `clip`
 * (viewport coordinates, as passed to page.screenshot; omit for the whole
 * viewport) is a fallback glyph, a 0px image, an image that did not come from
 * the committed copy, or still loading after `timeoutMs`. Returns how many marks it
 * checked; a frame with none passes. Throws MarksInFrameError, one line.
 */
export async function assertMarksInFrame(p, clip = null, { timeoutMs = 5000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    const r = await p.evaluate(inspectMarks, clip);
    if (r.pending.length && Date.now() < deadline) { await p.waitForTimeout(100); continue; }
    const bad = [...r.bad, ...r.pending.map(l => `${l}: still loading after ${timeoutMs} ms`)];
    if (bad.length) {
      const more = bad.length > 3 ? `; and ${bad.length - 3} more` : '';
      throw new MarksInFrameError(
        `${bad.length} of ${r.checked} species marks in frame are not the site icons: ${bad.slice(0, 3).join('; ')}${more}`);
    }
    return r.checked;
  }
}

// Select a destination by its EXACT rendered text, in whichever form the
// navigation is showing. Waits for the nav to exist first, so it cannot race the
// initial CSV load.
//
// THREE FORMS, because the nav is one component at three densities (nav-rework):
//   * the vertical SIDEBAR and the icon RAIL are both a role="tablist" of
//     role="tab" buttons. The rail's buttons have no visible text, so match the
//     aria-label as well as the text content — this is the case the old
//     strip-only matcher would have failed on with a plausible-looking error.
//   * the phone BOTTOM BAR holds four favourites plus a More button that opens a
//     sheet. A destination is either a cell or a row of that sheet, so try the
//     bar first and open the sheet only if it is not there.
//
// A miss THROWS. It used to return false, which meant a renamed label, or a nav
// in a shape the matcher did not know, silently yielded a screenshot of whatever
// tab was already open, with an exit code of 0. Both of those actually happened.
// A wrong-but-plausible screenshot is far worse than a missing one, so this fails
// loudly instead. (Still check the output images by eye: this catches the
// wrong-tab class of failure, not a tab that rendered badly.)
export async function selectTab(p, name) {
  await p.waitForSelector('[role="tab"], .sr-navbar-cell', { timeout: 30000 });

  // The name a control offers: its visible text, else its accessible label (the
  // rail draws icons only).
  const nameOf = async h =>
    ((await h.textContent()) || '').trim() || ((await h.getAttribute('aria-label')) || '').trim();

  const clickMatch = async (handles, seen) => {
    for (const h of handles) {
      const text = await nameOf(h);
      seen.push(text);
      if (text === name) { await h.click(); return true; }
    }
    return false;
  };

  // Sidebar / rail: one vertical tablist holding every destination.
  const tabs = await p.$$('[role="tab"]');
  if (tabs.length) {
    const seen = [];
    if (await clickMatch(tabs, seen)) return;
    throw new Error(`destination "${name}" not in the nav list — saw: ${seen.join(' | ')}`);
  }

  // Phone: the four favourites in the bar, then the More sheet for the rest.
  const seen = [];
  if (await clickMatch(await p.$$('.sr-navbar-cell'), seen)) return;

  const more = await p.$('.sr-navbar button[aria-haspopup="dialog"]');
  if (!more) throw new Error(`no nav list and no bottom bar while looking for "${name}"`);
  await more.click();
  await p.waitForSelector('[role="dialog"] .sr-nav-item', { timeout: 5000 });
  await p.waitForTimeout(400);   // let the sheet finish rising
  if (await clickMatch(await p.$$('[role="dialog"] .sr-nav-item'), seen)) return;
  throw new Error(`destination "${name}" not in the bottom bar or the More sheet — saw: ${seen.join(' | ')}`);
}

// ---- demo-dataset guard: fail closed BEFORE the first frame ----
//
// SHARED, and that is the point (security review, nav-rework). A capture script
// photographs whatever backend it is pointed at. Pointed at one serving a real
// export — the exact mistake SR_DATA_DIR exists to prevent — it produces
// correctly-dimensioned, publishable images of real personal sighting locations
// and exits 0. This guard lived only in capture-appstore.mjs while capture.mjs,
// which writes every image on the public website, had nothing but a
// sanity-check-by-eye instruction in the README. It lives here now so that EVERY
// script writing a published artifact gets it, including the next one.
//
// The marker is STRUCTURAL rather than a species or checklist count, which
// legitimately moves whenever the generator is re-run: gen-demo-data.mjs issues
// submission ids above eBird's live allocation (S9xxxxxxxxx), so no real export
// can carry them. Read from the BACKEND, not from the CSV on disk — the file
// being demo data proves nothing about what the server is serving, which is the
// process-hygiene failure a leftover backend on the same port produces.
//
// Fails closed in all three directions: demo data passes, a non-demo export is
// refused by id range, and a backend that cannot be read at all is refused
// rather than assumed empty.
export async function assertBackendServesDemoData(base, log = console.log) {
  let csv;
  try {
    const res = await fetch(`${base}/settings/files/ebird`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    csv = await res.text();
  } catch (e) {
    throw new Error(
      `could not read the backend's eBird export from ${base} to verify it is the demo dataset: ${e.message}`);
  }
  const ids = new Set();
  for (const line of csv.split('\n').slice(1)) {
    const sub = line.slice(0, line.indexOf(','));
    if (sub.startsWith('S')) ids.add(sub);
  }
  if (ids.size === 0) throw new Error('no submission ids found in the backend export — refusing to capture');
  const foreign = [...ids].filter(id => !/^S9\d{9}$/.test(id));
  if (foreign.length) {
    throw new Error(
      `backend at ${base} is NOT serving the synthetic demo dataset ` +
      `(${foreign.length} of ${ids.size} submission ids are outside the demo range, e.g. ${foreign[0]}). ` +
      `Refusing to capture. Start the backend with ` +
      `SR_DATA_DIR=<repo>/website/tools/demo-data before running this script.`);
  }
  log(`demo-dataset guard OK (${ids.size} synthetic checklists)`);
}

// ---- demo exotic-provenance stub (shared by both capture scripts) ----
// The Statistics escapee pass asks eBird about each checklist that carries a
// species. The demo dataset's submission ids are SYNTHETIC and deliberately
// above eBird's live allocation, so a real lookup 404s and the tab renders its
// honest "eBird could not be reached" banner — correct behaviour, wrong thing to
// photograph. Answer those lookups from the demo dataset itself instead.
//
// This lived in capture-appstore.mjs alone until v1.0.4, which is why the
// website capture (older than the escapee feature) started showing the banner
// the moment its shots were regenerated. One copy, both consumers.
export async function buildProvenanceStub(base, csvUrl) {
  const csv = readFileSync(csvUrl, 'utf8');
  const lines = csv.split('\n').slice(1).filter(Boolean);
  const bySub = new Map(); // subId -> Set(commonName)
  const names = new Map(); // commonName -> scientificName
  for (const line of lines) {
    // The generated CSV only quotes comment fields (cols 20+); cols 0-2 are
    // plain, so a simple split is safe for them.
    const cols = line.split(',');
    const [sub, common, sci] = cols;
    if (!sub || !sub.startsWith('S')) continue;
    if (!bySub.has(sub)) bySub.set(sub, new Set());
    bySub.get(sub).add(common);
    names.set(common, sci ?? '');
  }
  const res = await fetch(`${base}/taxonomy/codes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ species: [...names].map(([commonName, scientificName]) => ({ commonName, scientificName })) }),
  });
  const { codes } = await res.json();
  const missing = [...names.keys()].filter(n => !codes[n]);
  if (missing.length) throw new Error(`taxonomy codes missing for: ${missing.join(', ')}`);
  const bySubCodes = new Map();
  for (const [sub, set] of bySub) {
    bySubCodes.set(sub, [...set].map(n => ({ speciesCode: codes[n], exoticCategory: '' })));
  }
  return bySubCodes;
}

/** Install the escapee-pass stubs on a context. Playwright resolves a request
 *  against the MOST RECENTLY registered matching route, so install these before
 *  any catch-all a caller adds.
 *
 *  SCOPE IT: install this only on the contexts whose frame depends on it (the
 *  Statistics shots), never on every context. Registering ANY Playwright route
 *  on a context, whatever its pattern, cancels every cross-origin <img> load in
 *  that context. Measured with Playwright 1.62.1 / Chromium 1234 over a CDP
 *  Network session: both SpeciesLinks glyph requests (the ebird.org and
 *  birdsoftheworld.org favicons) are issued and die with net::ERR_ABORTED
 *  canceled=true, identically for this stub's own checklists pattern and for a
 *  pattern that matches nothing; with no route registered both load.
 *  Same-origin traffic and fetch()-initiated cross-origin calls are unaffected;
 *  the breakage is specific to <img> element loads. It used to cost every
 *  context this is installed on its species marks: empty slots at first, and
 *  since v1.0.19 SpeciesLinks' FALLBACK glyphs (a Globe and a SquareLibrary, in
 *  app ink). It no longer does (screenshot-tool-ebird-icon): makePage serves
 *  both marks as data: URLs through an init script (see loadSiteMarks), so they
 *  are never cross-origin loads for a route to cancel. Any OTHER cross-origin
 *  <img> still is, so the scoping rule stands. capture.mjs installed this on
 *  every context until the capture-provenance-route-scope fix and shipped four
 *  website shots that way. Both consumers now pass it per shot (each script's
 *  `statsRoutes`). The one other route either script registers is the per-shot
 *  WEATHER_REPLAY abort on the weather context, whose frame has no mark; that
 *  one is intentional. */
export async function installProvenanceRoutes(ctx, stub) {
  await ctx.route('**/checklists/**', async (route) => {
    const m = route.request().url().match(/\/checklists\/(S\d+)/);
    const species = (m && stub.get(m[1])) || [];
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ species }) });
  });
  // Keep the pass's cache out of the demo store so every run is identical
  // (a from-cache settle renders a different sentence).
  await ctx.route('**/settings/exotic-provenance*', async (route) => {
    if (route.request().method() === 'GET') await route.fulfill({ status: 404, contentType: 'application/json', body: '{"detail":"Not Found"}' });
    else await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
  });
}
