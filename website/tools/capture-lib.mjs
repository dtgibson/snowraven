// Shared Playwright helpers for the two screenshot capture scripts
// (capture.mjs → website shots, capture-appstore.mjs → App Store sets).
// Extracted verbatim from capture.mjs so both consumers drive the app the
// same way; the only change is parameterization (the browser instance and
// the deviceScaleFactor are arguments instead of module state).

// Chromium flags for headless WebGL (the MapLibre maps render through
// SwiftShader) plus hidden scrollbars so captures are clean.
export const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'];

// New context + page with the app theme pre-seeded (the sr-theme localStorage
// key is read by the app's anti-flash script before first paint).
export async function makePage(browser, theme, vp, deviceScaleFactor = 2) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor });
  await ctx.addInitScript((t) => { try { localStorage.setItem('sr-theme', t); } catch (e) {} }, theme);
  const p = await ctx.newPage();
  p.setDefaultTimeout(30000);
  return { ctx, p };
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
  const { readFileSync } = await import('node:fs');
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
 *  the breakage is specific to <img> element loads. Since v1.0.19 SpeciesLinks
 *  answers a failed favicon with a bundled lucide glyph in the same slot, so a
 *  tab that renders BirdName / SpeciesLinks photographs those FALLBACK glyphs
 *  (a Globe and a SquareLibrary, in app ink) on any context this is installed
 *  on -- it photographed empty slots before that build. capture.mjs installed
 *  it on every context until the capture-provenance-route-scope fix and shipped
 *  four website shots that way. Both consumers now pass it per shot (each
 *  script's `statsRoutes`). The one other route either script registers is the
 *  per-shot WEATHER_REPLAY abort on the weather context, whose frame has no
 *  glyph; that one is intentional. */
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
