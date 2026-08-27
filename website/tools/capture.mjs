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
import { GL, makePage, selectTab, buildProvenanceStub, installProvenanceRoutes } from './capture-lib.mjs';

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

// Desktop capture width. LOAD-BEARING, not arbitrary: TabNav collapses the tab
// strip into a dropdown the moment it would overflow (needed > clientWidth - 48).
// With the current ten tabs + Settings the strip needs ~1409px, so it collapses
// below a ~1457px viewport — the old 1440 capture width now lands on the WRONG
// side of that line and photographs a dropdown instead of the navigation. 1600
// clears it with headroom. If a future tab pushes the strip past ~1550, raise
// this (the shots are downscaled to 1600px wide, so going wider is cheap).
const DESKTOP_VP = { width: 1600, height: 900 };

// page()/selectTab() and the GL flags live in capture-lib.mjs (shared with
// capture-appstore.mjs). This wrapper pins the website shots' deviceScaleFactor
// of 2, exactly as before the extraction.
const browser = await chromium.launch({ headless: true, args: GL });

// The Statistics escapee pass is answered from the demo dataset, never the real
// eBird API: the demo's submission ids are synthetic, so a live lookup 404s and
// the tab correctly renders "eBird could not be reached" — an honest state, and
// not what the website should photograph. Built once and installed on every
// context (harmless on tabs that make no such lookup).
const provenanceStub = await buildProvenanceStub(BASE, new URL('./demo-data/ebird-backup.csv', import.meta.url));

const page = async (theme, vp) => {
  const made = await makePage(browser, theme, vp, 2);
  await installProvenanceRoutes(made.ctx, provenanceStub);
  return made;
};
const log = (...a) => console.log(...a);

// --- generic data tab ---
async function tab(name, file, { theme = 'light', vp = DESKTOP_VP, settle = 4000, clipH = 900, prep = null } = {}) {
  const { ctx, p } = await page(theme, vp);
  try {
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

await tab('Statistics', 'stats-light.png', { clipH: 900 });
await tab('Statistics', 'stats-dark.png', { theme: 'dark', clipH: 900 });
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

// Mobile Statistics — nav is a dropdown at narrow widths
await (async () => {
  const { ctx, p } = await page('light', { width: 402, height: 880 });
  try {
    await p.goto(BASE, { waitUntil: 'domcontentloaded' });
    await selectTab(p, 'Statistics');
    await p.waitForLoadState('networkidle').catch(() => {}); await p.waitForTimeout(4000);
    await p.screenshot({ path: `${OUT}stats-mobile.png`, clip: { x: 0, y: 0, width: 402, height: 860 } });
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
    // everything else stay live.
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
