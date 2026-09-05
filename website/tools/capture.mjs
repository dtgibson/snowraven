// Capture the SnowRaven UI screenshots used on the website, driving a running
// instance with Playwright. The instance MUST be serving the SYNTHETIC demo data
// (see README.md / gen-demo-data.mjs) — never the user's real eBird data.
//
//   BASE      app origin (default http://localhost:1620)
//   CHECKLIST a real PUBLIC coastal eBird checklist id for the live weather+tide
//             shot (so a tide shows). Override via env if the default has aged out.
//
// Output: ./shots/*.png  (then run process-img.mjs to make the WebP assets).
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { GL, makePage, selectTab, buildProvenanceStub, installProvenanceRoutes, assertBackendServesDemoData } from './capture-lib.mjs';

const BASE = process.env.BASE || 'http://localhost:1620';
const CHECKLIST = process.env.CHECKLIST || 'S354229002'; // coastal -> shows tide
// WEATHER_REPLAY=1 captures the weather shot from the app's own offline-replay
// path instead of a live OpenWeather call, for rigs whose backend/.env carries
// no usable OpenWeather key (this repo's demo rig). The demo store's replay
// entry holds a genuine past result for CHECKLIST and renders identically to a
// live success. Ported from capture-appstore.mjs, which has had it since 1.0.0
// — without it this shot silently published an error state (v1.0.4).
const WEATHER_REPLAY = process.env.WEATHER_REPLAY === '1';
const OUT = new URL('./shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

// FAIL CLOSED BEFORE THE FIRST FRAME. Every image on the public website is
// written by this script, so a backend accidentally serving a real export would
// publish real sighting locations and exit 0. The README's sanity-check-by-eye
// was the only thing standing here until the security review in nav-rework; the
// structural id-range guard is shared with capture-appstore.mjs and lives in
// capture-lib.mjs.
// (uses the default console.log — `log` is declared further down.)
await assertBackendServesDemoData(BASE);

// Desktop capture width. STILL LOAD-BEARING, for a different reason than before.
//
// It used to be a race against the tab strip's overflow: the strip needed
// ~1409px and collapsed into a dropdown below a ~1457px viewport, so the old
// 1440 width silently photographed a dropdown instead of the navigation, and
// 1600 was chosen to clear that line. The strip and its dropdown are gone
// (nav-rework), so that threshold no longer exists.
//
// What the width now decides is WHICH DENSITY of the one responsive nav gets
// photographed. The nav shows the labelled sidebar while
//
//     viewport - 13.5rem - (the active tab's own sidebar) >= 640
//
// and the icon rail otherwise, where 13.5rem is 216px at the capture's 1x scale
// and the Map Explorer reserves clamp(240px, 28vw, 300px) for its own sidebar.
// The binding case is therefore the map shot: it needs at least ~1156px, while
// every other tab needs ~856px. 1600 photographs the sidebar on every tab with
// roughly 440px of headroom on the tightest one.
//
// So: keep this comfortably above ~1156. Going wider is cheap (the shots are
// downscaled to 1600px), and going below ~1156 does not fail loudly — it
// quietly photographs the rail, which is a real density but not the one these
// shots are meant to show. Check the images.
const DESKTOP_VP = { width: 1600, height: 900 };

// page()/selectTab() and the GL flags live in capture-lib.mjs (shared with
// capture-appstore.mjs). This wrapper pins the website shots' deviceScaleFactor
// of 2, exactly as before the extraction. It registers NO routes: a context
// gets a route only from a shot's own `routes` hook, and only where that shot's
// frame depends on it (see the note below).
const browser = await chromium.launch({ headless: true, args: GL });
const page = (theme, vp) => makePage(browser, theme, vp, 2);
const log = (...a) => console.log(...a);

// The Statistics escapee pass is answered from the demo dataset, never the real
// eBird API: the demo's submission ids are synthetic, so a live lookup 404s and
// the tab correctly renders "eBird could not be reached", an honest state and
// not what the website should photograph. The stub is built once and installed
// ONLY on the three Statistics contexts (the two desktop shots and the mobile
// block), passed per shot as `routes: statsRoutes`, the same per-shot shape
// capture-appstore.mjs uses for its 02-statistics shot.
//
// Until this fix it was installed on every context, under a comment calling
// that "harmless on tabs that make no such lookup". It is not harmless.
// Registering ANY Playwright route on a context, whatever its pattern, cancels
// every cross-origin <img> load in that context. Measured with Playwright
// 1.62.1 / Chromium 1234 over a CDP Network session: both SpeciesLinks glyph
// requests (https://ebird.org/favicon.ico, a 302 to S3, and
// https://birdsoftheworld.org/favicon.ico, a direct 200) are issued and die
// with net::ERR_ABORTED canceled=true, no CORS error and no blocked reason,
// identically for the real **/checklists/** pattern and for a pattern that
// matches nothing, eager or loading="lazy"; with no route registered both load
// (48px natural). Same-origin traffic, fetch()-initiated cross-origin calls
// and the map tiles are unaffected; the breakage is specific to <img> element
// loads. SpeciesLinks hides a glyph whose load fails, so the blanket install
// photographed empty 14px slots beside every species name on Species Detail,
// Breeding Codes, Multimedia and Named Birds, where an online user sees the
// eBird and Birds of the World glyphs.
//
// The rule: a route is scoped to the contexts whose frame DEPENDS on it, never
// registered on a context "just in case". Accepted, stated cost: the
// Statistics contexts keep the stub, so the one glyph in their frame (the
// "First species ever" card) stays absent, as it already does on the App Store
// Statistics shot. The only other route in this file is the per-shot
// WEATHER_REPLAY abort on the weather context, whose frame has no glyph; that
// one is intentional and stays.
const provenanceStub = await buildProvenanceStub(BASE, new URL('./demo-data/ebird-backup.csv', import.meta.url));
const statsRoutes = (ctx) => installProvenanceRoutes(ctx, provenanceStub);

// --- generic data tab ---
async function tab(name, file, { theme = 'light', vp = DESKTOP_VP, settle = 4000, clipH = 900, prep = null, routes = null } = {}) {
  const { ctx, p } = await page(theme, vp);
  try {
    if (routes) await routes(ctx);
    await p.goto(BASE, { waitUntil: 'domcontentloaded' });
    await selectTab(p, name);
    await p.waitForLoadState('networkidle').catch(() => {});
    await p.waitForTimeout(settle);
    if (prep) await prep(p);
    await p.screenshot({ path: `${OUT}${file}`, clip: clipH ? { x: 0, y: 0, width: vp.width, height: clipH } : undefined });
    log('OK', file);
  } catch (e) { log('FAIL', file, e.message.split('\n')[0]); }
  await ctx.close();
}

await tab('Statistics', 'stats-light.png', { clipH: 900, routes: statsRoutes });
await tab('Statistics', 'stats-dark.png', { theme: 'dark', clipH: 900, routes: statsRoutes });
await tab('Map Explorer', 'map-light.png', { settle: 6000, clipH: 860 });
await tab('Map Explorer', 'map-dark.png', { theme: 'dark', settle: 6000, clipH: 860 });
await tab('Breeding Codes', 'breeding-light.png', { settle: 4200, clipH: 900 });
await tab('Multimedia', 'media-light.png', { settle: 4200, clipH: 900 });
// Calendar and Named Birds both shipped after the previous capture (v0.5.23) and
// had never been photographed. Calendar is deliberately zero-network (it computes
// from the loaded backup), so it needs no extra settle for fetches.
//
// Calendar opens on the most recent year with data, which for the demo dataset is
// a part-year (it ends in May) and photographs as a mostly-empty grid. Step back
// one year for a full twelve months of shading.
await tab('Calendar', 'calendar-light.png', { settle: 4200, clipH: 900, prep: async (p) => {
  const prev = await p.$('button[aria-label="Previous year with data"]');
  if (prev && !(await prev.isDisabled())) { await prev.click(); await p.waitForTimeout(1200); }
} });
// Named Birds is a short list — clip close so the shot isn't mostly empty page.
await tab('Named Birds', 'named-birds-light.png', { settle: 4200, clipH: 620 });

// Species Detail — select a common species
await tab('Species Detail', 'species-light.png', { settle: 4200, clipH: 980, prep: async (p) => {
  const inp = await p.$('input[role="combobox"]') || await p.$('main input');
  if (!inp) return;
  await inp.click(); await inp.fill('Northern Cardinal'); await p.waitForTimeout(900);
  for (const o of await p.$$('[role="option"], li, button')) {
    const t = (await o.textContent() || '').trim();
    if (/^Northern Cardinal/i.test(t) && t.length < 60) { await o.click().catch(() => {}); break; }
  }
  await p.waitForTimeout(800); await p.keyboard.press('Escape').catch(() => {});
} });

// Mobile Statistics — at 402px the nav is the bottom bar plus its More sheet,
// and Statistics is a favourite, so selectTab finds it in the bar itself. The
// shot deliberately includes the bar: it is the phone navigation.
await (async () => {
  const { ctx, p } = await page('light', { width: 402, height: 880 });
  try {
    await statsRoutes(ctx); // the third and last Statistics context
    await p.goto(BASE, { waitUntil: 'domcontentloaded' });
    await selectTab(p, 'Statistics');
    await p.waitForLoadState('networkidle').catch(() => {}); await p.waitForTimeout(4000);
    // FULL viewport height, not the old 860 of 880. The phone navigation is a
    // FIXED bar at the bottom of the screen now, measured at 56.5px on this
    // viewport, so a clip 20px short of the bottom cut it in half: the icons
    // survived and every label fell outside the frame. Nothing failed, and the
    // shot looked plausible. Any clip on a phone capture has to include the bar.
    await p.screenshot({ path: `${OUT}stats-mobile.png`, clip: { x: 0, y: 0, width: 402, height: 880 } });
    log('OK stats-mobile.png');
  } catch (e) { log('FAIL stats-mobile.png', e.message.split('\n')[0]); }
  await ctx.close();
})();

// Weather + Tide — live lookup on a real PUBLIC coastal checklist; trim HTML attribution for a clean shot
await (async () => {
  const { ctx, p } = await page('light', { width: 900, height: 1320 });
  try {
    // Fail the live weather call at the connection level so the app serves its
    // stored replay result (the same code path as offline reuse); the tide and
    // everything else stay live. A route on THIS context is fine: the weather
    // frame renders no species glyph (see the route-scoping note above
    // statsRoutes), and it is registered here, per shot, not in page().
    if (WEATHER_REPLAY) await ctx.route(`**/weather/${CHECKLIST}*`, (route) => route.abort());
    await p.goto(BASE, { waitUntil: 'domcontentloaded' });
    await selectTab(p, 'Weather'); await p.waitForTimeout(400);
    const inp = await p.$('main input'); await inp.click(); await inp.fill(CHECKLIST);
    for (const btn of await p.$$('main button')) if ((await btn.getAttribute('role')) !== 'tab' && /get weather/i.test(await btn.textContent() || '')) { await btn.click(); break; }
    await p.waitForFunction(() => /Sunset|Tide|Station/i.test(document.querySelector('main')?.innerText || ''), { timeout: 40000 }).catch(() => {});
    await p.waitForTimeout(2200);
    await p.evaluate(() => document.querySelectorAll('pre,code,div').forEach((el) => {
      if (el.children.length === 0 && /Weather generated by|Tide data|generated by/i.test(el.textContent))
        el.textContent = el.textContent.replace(/\n?\s*(Weather generated by|Tide data|Generated by)[\s\S]*$/i, '').replace(/\s+$/, '');
    }));
    await p.waitForTimeout(300);
    // Never publish an error state. capture-appstore.mjs has had this check
    // since 1.0.0; the website capture did not, which is how a shot showing
    // "Weather data unavailable" reached the regeneration queue.
    const errored = await p.evaluate(() => /Weather data unavailable/i.test(document.querySelector('main')?.innerText || ''));
    if (errored) throw new Error('weather lookup errored (no usable OpenWeather key?) — fix the key or use WEATHER_REPLAY=1');
    const panel = await p.$('#panel-weather') || await p.$('main');
    const box = await panel.boundingBox();
    await p.screenshot({ path: `${OUT}weather-light.png`, clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: box.width, height: Math.min(box.height, 1280) } });
    log('OK weather-light.png');
  } catch (e) { log('FAIL weather-light.png', e.message.split('\n')[0]); }
  await ctx.close();
})();

await browser.close();
log('CAPTURE DONE — now run: node process-img.mjs');
