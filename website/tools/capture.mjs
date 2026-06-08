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

const BASE = process.env.BASE || 'http://localhost:1620';
const CHECKLIST = process.env.CHECKLIST || 'S354229002'; // coastal -> shows tide
const OUT = new URL('./shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });

const GL = ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars'];
const browser = await chromium.launch({ headless: true, args: GL });

async function page(theme, vp) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 2 });
  await ctx.addInitScript((t) => { try { localStorage.setItem('sr-theme', t); } catch (e) {} }, theme);
  const p = await ctx.newPage();
  p.setDefaultTimeout(30000);
  return { ctx, p };
}
async function clickTab(p, name) {
  for (const h of await p.$$('[role="tab"]')) if ((await h.textContent()).trim() === name) { await h.click(); return true; }
  return false;
}
const log = (...a) => console.log(...a);

// --- generic data tab ---
async function tab(name, file, { theme = 'light', vp = { width: 1440, height: 900 }, settle = 4000, clipH = 900, prep = null } = {}) {
  const { ctx, p } = await page(theme, vp);
  try {
    await p.goto(BASE, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(700);
    await clickTab(p, name);
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
    await p.goto(BASE, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(900);
    const b = await p.$('button[aria-haspopup="listbox"]'); if (b) await b.click();
    await p.waitForTimeout(400);
    for (const o of await p.$$('[role="option"], button, li')) if ((await o.textContent() || '').trim() === 'Statistics') { await o.click(); break; }
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
    await p.goto(BASE, { waitUntil: 'domcontentloaded' }); await p.waitForTimeout(800);
    await clickTab(p, 'Weather'); await p.waitForTimeout(400);
    const inp = await p.$('main input'); await inp.click(); await inp.fill(CHECKLIST);
    for (const btn of await p.$$('main button')) if ((await btn.getAttribute('role')) !== 'tab' && /get weather/i.test(await btn.textContent() || '')) { await btn.click(); break; }
    await p.waitForFunction(() => /Sunset|Tide|Station/i.test(document.querySelector('main')?.innerText || ''), { timeout: 40000 }).catch(() => {});
    await p.waitForTimeout(2200);
    await p.evaluate(() => document.querySelectorAll('pre,code,div').forEach((el) => {
      if (el.children.length === 0 && /Weather generated by|Tide data|generated by/i.test(el.textContent))
        el.textContent = el.textContent.replace(/\n?\s*(Weather generated by|Tide data|Generated by)[\s\S]*$/i, '').replace(/\s+$/, '');
    }));
    await p.waitForTimeout(300);
    const panel = await p.$('#panel-weather') || await p.$('main');
    const box = await panel.boundingBox();
    await p.screenshot({ path: `${OUT}weather-light.png`, clip: { x: Math.max(0, box.x), y: Math.max(0, box.y), width: box.width, height: Math.min(box.height, 1280) } });
    log('OK weather-light.png');
  } catch (e) { log('FAIL weather-light.png', e.message.split('\n')[0]); }
  await ctx.close();
})();

await browser.close();
log('CAPTURE DONE — now run: node process-img.mjs');
