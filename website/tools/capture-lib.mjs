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

// Select a tab by its EXACT rendered text, in whichever form the nav is showing:
// the horizontal strip (wide viewports) or the collapsed dropdown (narrow ones,
// and any viewport too small for the strip). Waits for the nav to exist first,
// so it cannot race the initial CSV load.
//
// A miss THROWS. It used to return false, which meant a renamed label — or a nav
// that had collapsed to a dropdown — silently yielded a screenshot of whatever
// tab was already open, with an exit code of 0. Both of those actually happened.
// A wrong-but-plausible screenshot is far worse than a missing one, so this fails
// loudly instead. (Still check the output images by eye: this catches the
// wrong-tab class of failure, not a tab that rendered badly.)
export async function selectTab(p, name) {
  await p.waitForSelector('[role="tab"], button[aria-haspopup="listbox"]', { timeout: 30000 });

  const strip = await p.$$('[role="tab"]');
  if (strip.length) {
    const seen = [];
    for (const h of strip) {
      const text = (await h.textContent() || '').trim();
      seen.push(text);
      if (text === name) { await h.click(); return; }
    }
    throw new Error(`tab "${name}" not in the tab strip — saw: ${seen.join(' | ')}`);
  }

  // Collapsed nav: open the listbox, then pick the option.
  const trigger = await p.$('button[aria-haspopup="listbox"]');
  if (!trigger) throw new Error(`no tab strip and no nav dropdown while looking for "${name}"`);
  await trigger.click();
  await p.waitForTimeout(400);
  const seen = [];
  for (const o of await p.$$('[role="option"], [role="listbox"] button, [role="listbox"] li')) {
    const text = (await o.textContent() || '').trim();
    seen.push(text);
    if (text === name) { await o.click(); return; }
  }
  throw new Error(`tab "${name}" not in the nav dropdown — saw: ${seen.join(' | ')}`);
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
 *  any catch-all a caller adds. */
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
