// App Store screenshot capture — the SECOND consumer of the capture pipeline
// (capture.mjs is the website's). Drives a running SnowRaven instance that MUST
// be serving the SYNTHETIC demo dataset via SR_DATA_DIR (see README.md) — never
// the user's real eBird data: these PNGs are published on the App Store.
//
//   BASE      app origin (default http://localhost:1620)
//   CHECKLIST a real PUBLIC coastal eBird checklist id for the live weather+tide
//             shot (so a tide shows). Override via env if the default has aged out.
//   FAMILY    optional: capture only "iphone" or "ipad" (default: both)
//   WEATHER_REPLAY=1  capture the weather shot from the app's own offline-replay
//             path instead of a live OpenWeather call. For rigs whose
//             backend/.env deliberately carries no real OpenWeather key (this
//             repo's demo rig): the demo store's replay entry holds a genuine
//             past result for CHECKLIST, and the rendered output is identical
//             to a live success (the offline cue sits above the framed region).
//             With a real key in .env, omit this and the shot is fully live.
//
// Output: ../../appstore/screenshots/{iphone-6.9,ipad-13}/*.png — committed.
// PNG is the deliverable format (App Store Connect accepts PNG/JPEG), so
// process-img.mjs (WebP, website-only) is NOT part of this path.
//
// Device dimensions (portrait). Re-verified against App Store Connect's
// accepted-size list on 2026-08-25: as of 2025+ ASC requires only ONE size per
// family — the 6.9-inch iPhone class (accepts 1320x2868, 1290x2796, 1260x2736)
// and the 13-inch iPad class (accepts 2064x2752, 2048x2732) — and scales the
// smaller devices from it. The viewport math is exact:
//   iPhone 6.9"  1320 x 2868 = viewport 440 x 956  @ deviceScaleFactor 3
//   iPad 13"     2064 x 2752 = viewport 1032 x 1376 @ deviceScaleFactor 2
// If Apple moves the accepted list, adjust these constants (and re-verify the
// note in appstore/LISTING.md's record).
//
// Two deliberate fidelity rules, both about depicting the iOS APP rather than
// the web build Chromium renders:
// - The footer's "Check For Updates" affordance is REMOVED before every shot.
//   The iOS build renders the footer without it (UpdateFooter returns null on
//   iOS — platformGates FR-14; iOS apps must not self-update), so leaving it in
//   would show a control the depicted product does not have. Nothing is added.
// - The Statistics shot stubs the escapee-provenance checklist lookups with the
//   demo dataset's own species (exoticCategory empty = not exotic), so the pass
//   completes to the same end state a real user with this data would see
//   ("None of your species are eBird escapees") WITHOUT firing synthetic
//   checklist IDs at the real eBird API — the capture rig must never send junk
//   requests to eBird (the repo's standing eBird-manners posture). The stub
//   also keeps the pass's cache out of the demo store so reruns are identical.
//
// Every screenshot is dimension-verified after capture (sharp) and any failed
// shot fails the whole run with a nonzero exit: a wrong-but-plausible App Store
// screenshot is far worse than a missing one (same posture as selectTab).
import { chromium } from 'playwright';
import { mkdirSync, readFileSync } from 'node:fs';
import sharp from 'sharp';
import { GL, makePage, selectTab } from './capture-lib.mjs';

const BASE = process.env.BASE || 'http://localhost:1620';
const CHECKLIST = process.env.CHECKLIST || 'S354229002'; // coastal -> shows tide
const ONLY = process.env.FAMILY || '';
const WEATHER_REPLAY = process.env.WEATHER_REPLAY === '1';

const FAMILIES = [
  { key: 'iphone', dir: 'iphone-6.9', vp: { width: 440, height: 956 }, dsf: 3, px: { w: 1320, h: 2868 }, phone: true },
  { key: 'ipad', dir: 'ipad-13', vp: { width: 1032, height: 1376 }, dsf: 2, px: { w: 2064, h: 2752 }, phone: false },
].filter(f => !ONLY || f.key === ONLY);

// The one location whose popup opens in shot 1. Must exist in the demo dataset
// (gen-demo-data.mjs LOCS) — QA-05: every visible name comes from the demo data.
const POPUP_LOCATION = 'Jamaica Bay Wildlife Refuge';

const OUT_ROOT = new URL('../../appstore/screenshots/', import.meta.url).pathname;
const browser = await chromium.launch({ headless: true, args: GL });
const failures = [];
const log = (...a) => console.log(...a);

// ---- demo checklist -> species-code map (for the Statistics escapee stub) ----
// Parsed once from the generated demo CSV; codes resolved through the running
// backend's own taxonomy (the same source the app uses).
async function buildProvenanceStub() {
  const csv = readFileSync(new URL('./demo-data/ebird-backup.csv', import.meta.url), 'utf8');
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
  const res = await fetch(`${BASE}/taxonomy/codes`, {
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
let provenanceStub = null;

// Remove the web-only "Check For Updates" footer affordance so the footer is
// exactly what the iOS build renders (see the fidelity rule above). The button
// and its ' · ' separator are UpdateFooter's contribution; on iOS that
// component renders null.
async function stripUpdaterFooter(p) {
  await p.evaluate(() => {
    for (const btn of document.querySelectorAll('footer button, [class*="footer"] button, button')) {
      if ((btn.textContent || '').trim() === 'Check For Updates') {
        const prev = btn.previousSibling;
        if (prev && prev.nodeType === Node.TEXT_NODE && /·\s*$/.test(prev.textContent || '')) prev.remove();
        btn.remove();
      }
    }
  });
  await p.waitForTimeout(400); // let the measured map-panel chrome settle
}

async function capture(fam, file, run, routes = null) {
  const { ctx, p } = await makePage(browser, 'light', fam.vp, fam.dsf);
  const path = `${OUT_ROOT}${fam.dir}/${file}`;
  try {
    if (routes) await routes(ctx);
    await p.goto(BASE, { waitUntil: 'domcontentloaded' });
    await run(p, fam);
    await stripUpdaterFooter(p);
    await p.screenshot({ path }); // viewport screenshot -> exactly px.w x px.h
    const meta = await sharp(path).metadata();
    if (meta.width !== fam.px.w || meta.height !== fam.px.h) {
      throw new Error(`wrong dimensions ${meta.width}x${meta.height}, expected ${fam.px.w}x${fam.px.h}`);
    }
    log('OK', fam.dir + '/' + file);
  } catch (e) {
    failures.push(`${fam.dir}/${file}: ${e.message.split('\n')[0]}`);
    log('FAIL', fam.dir + '/' + file, e.message.split('\n')[0]);
  }
  await ctx.close();
}

// 1 · Map Explorer — the demo birder's sightings, with the Jamaica Bay popup
// open. The popup is opened through the keyboard-accessible "Sightings in view"
// list (a DOM path — the GL pins aren't reachable by selector), which pans the
// map to the location and shows the same popup a pin click would. Deliberately
// the offline My Sightings view: a live Hotspots search would put real,
// non-demo-dataset hotspot names in the iPad sidebar's lists (QA-05).
async function shotMap(p, fam) {
  await selectTab(p, 'Map Explorer');
  await p.waitForLoadState('networkidle').catch(() => {});
  await p.waitForTimeout(6000); // tiles + GL layers settle
  if (fam.phone) {
    await p.click('button[aria-label="Open map filters"]');
    await p.waitForTimeout(600);
  }
  const row = p.locator('ul[aria-label="Sightings in view"] button').filter({ hasText: POPUP_LOCATION }).first();
  await row.click();
  await p.waitForTimeout(1500); // pan + popup
  if (fam.phone) {
    await p.click('button[aria-label="Close filters"]');
    await p.waitForTimeout(500);
    // The popup opens upward from the panned-to-center pin and would overlap
    // the layer switcher at phone width; drag the map down so it clears. The
    // drag starts left of the popup, over bare map, and pans without clicking
    // (MapLibre suppresses click after a real drag), so the popup stays open.
    const canvas = await p.$('canvas');
    if (canvas) {
      await p.mouse.move(50, 450);
      await p.mouse.down();
      await p.mouse.move(50, 575, { steps: 8 });
      await p.mouse.up();
    }
  }
  await p.waitForTimeout(1800); // tiles for the panned view
}

// 2 · Statistics — waits for the stubbed escapee pass to reach its terminal
// "Exotic status checked" state so no spinner/progress UI is mid-flight.
async function shotStats(p) {
  await selectTab(p, 'Statistics');
  await p.waitForLoadState('networkidle').catch(() => {});
  await p.waitForFunction(
    () => /Exotic status checked across/i.test(document.querySelector('main')?.innerText || ''),
    { timeout: 120000 },
  );
  await p.waitForTimeout(2500);
}
function statsRoutes(ctx) {
  return (async () => {
    if (!provenanceStub) provenanceStub = await buildProvenanceStub();
    // The escapee pass's per-checklist lookups: answer from the demo dataset
    // itself, never the real eBird API (see the fidelity rules above).
    await ctx.route('**/checklists/**', async (route) => {
      const m = route.request().url().match(/\/checklists\/(S\d+)/);
      const species = (m && provenanceStub.get(m[1])) || [];
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ species }) });
    });
    // Keep the pass's cache out of the demo store so every run is identical
    // (a from-cache settle renders a different sentence).
    await ctx.route('**/settings/exotic-provenance*', async (route) => {
      if (route.request().method() === 'GET') await route.fulfill({ status: 404, contentType: 'application/json', body: '{"detail":"Not Found"}' });
      else await route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
    });
  })();
}

// 3 · Weather & Tide — the founding lookup on a real PUBLIC coastal checklist,
// scrolled so the formatted weather block, the tide, and the copy actions fill
// the frame. The attribution lines are NOT trimmed (unlike the website
// capture): an App Store screenshot shows the app's real output, untouched.
async function shotWeather(p) {
  await selectTab(p, 'Weather');
  await p.waitForTimeout(600);
  const inp = await p.$('main input');
  await inp.click();
  await inp.fill(CHECKLIST);
  for (const btn of await p.$$('main button')) {
    if ((await btn.getAttribute('role')) !== 'tab' && /get weather/i.test(await btn.textContent() || '')) { await btn.click(); break; }
  }
  await p.waitForFunction(
    () => {
      const t = document.querySelector('main')?.innerText || '';
      return /Sunrise|Sunset/i.test(t) && /Tide|Station/i.test(t);
    },
    { timeout: 60000 },
  );
  await p.waitForTimeout(2500);
  const errored = await p.evaluate(() => /Weather data unavailable/i.test(document.querySelector('main')?.innerText || ''));
  if (errored) throw new Error('weather lookup errored (no usable OpenWeather key?) — fix the key or use WEATHER_REPLAY=1');
  // Expand the weather-backlog disclosure so the page is tall enough to scroll
  // the result block to the top of the frame on the tall iPad viewport (the
  // backlog itself stays below the fold; it computes offline from the backup).
  await p.locator('button').filter({ hasText: 'List checklists with no weather blocks' }).first().click().catch(() => {});
  await p.waitForTimeout(1200);
  // Frame from the looked-up checklist's own header (the edit link + id/place
  // line) down through the weather block, the tide, and the copy actions.
  await p.evaluate(() => {
    const link = [...document.querySelectorAll('a')].find(a => /Edit checklist comment/i.test(a.textContent || ''));
    if (link) { link.scrollIntoView({ block: 'start' }); window.scrollBy(0, -14); }
  });
  await p.waitForTimeout(500);
}
function weatherRoutes(ctx) {
  if (!WEATHER_REPLAY) return Promise.resolve();
  // Fail the live weather call at the connection level so the app serves its
  // stored replay result (the same code path as offline reuse); the tide and
  // everything else stay live.
  return ctx.route(`**/weather/${CHECKLIST}*`, (route) => route.abort());
}

// 4 · Calendar — the previous (complete) year, in the year-overview ("Large")
// view, scrolled so the shaded month grids fill the frame. The demo dataset
// ends mid-2026, so the newest year photographs part-empty; step back one year.
async function shotCalendar(p) {
  await selectTab(p, 'Calendar');
  await p.waitForTimeout(3500);
  const prev = await p.$('button[aria-label="Previous year with data"]');
  if (prev && !(await prev.isDisabled())) { await prev.click(); await p.waitForTimeout(1000); }
  await p.locator('[role="group"][aria-label="Calendar view"] button').filter({ hasText: 'Large' }).click();
  await p.waitForTimeout(1500);
  // Frame from the year header (year, "Species seen each day · N days birded",
  // and the legend) down into the shaded month grids.
  await p.evaluate(() => {
    const leaf = [...document.querySelectorAll('div')].find(e => e.children.length === 0 && /days birded/.test(e.textContent || ''));
    const row = leaf?.parentElement?.parentElement;
    if (row) { row.scrollIntoView({ block: 'start' }); window.scrollBy(0, -12); }
  });
  await p.waitForTimeout(500);
}

// 5 · Species Detail — Northern Cardinal (in the demo dataset).
async function shotSpecies(p) {
  await selectTab(p, 'Species Detail');
  await p.waitForTimeout(4200);
  const inp = await p.$('input[role="combobox"]') || await p.$('main input');
  if (!inp) throw new Error('species search input not found');
  await inp.click();
  await inp.fill('Northern Cardinal');
  await p.waitForTimeout(900);
  for (const o of await p.$$('[role="option"], li, button')) {
    const t = (await o.textContent() || '').trim();
    if (/^Northern Cardinal/i.test(t) && t.length < 60) { await o.click().catch(() => {}); break; }
  }
  await p.waitForTimeout(1200);
  await p.keyboard.press('Escape').catch(() => {});
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(600);
}

// 6 · Breeding Codes — on the phone the filter pills alone fill a frame, so
// scroll the matrix (the tab's actual subject) into it, keeping the count/
// pin/unbounded control row visible above the header row.
async function shotBreeding(p, fam) {
  await selectTab(p, 'Breeding Codes');
  await p.waitForTimeout(4200);
  if (fam.phone) {
    await p.evaluate(() => {
      const table = document.querySelector('table');
      if (table) { table.scrollIntoView({ block: 'start' }); window.scrollBy(0, -70); }
    });
    await p.waitForTimeout(500);
  }
}

const SHOTS = [
  ['01-map-explorer.png', shotMap, null],
  ['02-statistics.png', shotStats, statsRoutes],
  ['03-weather-tide.png', shotWeather, weatherRoutes],
  ['04-calendar.png', shotCalendar, null],
  ['05-species-detail.png', shotSpecies, null],
  ['06-breeding-codes.png', shotBreeding, null],
];

for (const fam of FAMILIES) {
  mkdirSync(`${OUT_ROOT}${fam.dir}`, { recursive: true });
  for (const [file, run, routes] of SHOTS) await capture(fam, file, run, routes);
}

await browser.close();
if (failures.length) {
  console.error(`CAPTURE FAILED (${failures.length}):\n  ` + failures.join('\n  '));
  process.exit(1);
}
log('APP STORE CAPTURE DONE — review every image by eye before committing.');
