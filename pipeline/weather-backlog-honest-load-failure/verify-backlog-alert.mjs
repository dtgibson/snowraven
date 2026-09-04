// Real-engine verification of the Weather tab checklist backlog's load-failure
// live region (v1.0.16, fix: weather-backlog-honest-load-failure).
//
// WHY IT EXISTS. `.claude/rules/ui.md`: a live-region change is not verified
// until it has been read out of a REAL engine's accessibility tree, in BOTH
// engines, with the region IDLE. jsdom loads no stylesheet and has no
// accessibility tree, so the component suite proves React's reconciliation and
// nothing about whether the region is announceable. It also runs against the
// build that LACKS the fix and reports whether it failed there, because a
// harness nobody has seen fail is an assertion rather than a measurement.
//
// WHAT IT DOES. Serves a production `dist` as the web/Pi build behind a stub
// backend that reports a STORED eBird backup whose bytes will not come back (a
// 500 on /settings/files/ebird -> WebStorage.readFile resolves null ->
// loadEbirdObservations resolves null), so the defect state is reached through
// the real storage seam rather than by injection. Then, in Chromium and WebKit:
// the idle region's `ariaSnapshot`, a computed-style walk from it to <html> for
// hiding values and aria-hidden, Chromium CDP `Accessibility.getPartialAXTree`
// for `ignored`/`live`, the populated region's snapshot, the collapse and
// re-expand path, and a 320px / 200% in-app text-scale overflow probe.
//
//   node verify-backlog-alert.mjs <distDir>                  # expect all green
//   node verify-backlog-alert.mjs <preFixDist> --expect-broken   # expect red
//
// Exit code is 0 when the run matched the mode, 1 otherwise, so it is CI-shaped
// already: ephemeral port, no global state, no fixtures on disk.
//
// REUSING IT ELSEWHERE. It is deliberately a pipeline artifact rather than repo
// tooling, because promoting it is its own build, not a ride-along. What that
// build would take: move it under a tools directory with a `package.json` script,
// and decide the dependency question, since Playwright is not a `frontend`
// dependency -- it lives in `website/tools/node_modules` for the screenshot
// scripts, which is why the resolver below points there, and the browsers come
// from the shared `ms-playwright` cache. Everything else generalizes as-is: the
// stub backend is the honest way to drive ANY stored-file state (swap what
// /settings/files and /settings/files/<slot> answer), and the three
// accessibility probes are per-region rather than per-feature. It would also give
// this repo something it has not had: builds 1 and 2 of this bundle shipped their
// WebKit tab-order claims on inference, because jsdom has no tab order at all.
//
// ONE THING TO FIX AT PROMOTION, recorded here because here is where a promoting
// build will read it. `TYPES[extname(file)]` below is a bare object-literal
// lookup keyed by a string derived from the request path, which is the shape
// `.claude/rules/security.md` requires `Object.hasOwn` on (v0.5.81): a key
// colliding with an `Object.prototype` member would otherwise return an
// inherited value as the content type. It is safe as it stands, on an invariant
// rather than a guard -- `extname` returns either the empty string or a
// leading-dot string, and no `Object.prototype` member begins with a dot -- and
// this serves a local dist to a headless browser on an ephemeral port. That is
// an argument for leaving it in a throwaway harness, not for shipping it as
// tooling: the invariant is one refactor of the key away from being untrue. At
// promotion, switch it to `Object.hasOwn(TYPES, ext) ? TYPES[ext] : <fallback>`
// and stop resting on it.

import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, extname, resolve } from 'node:path';
import { createRequire } from 'node:module';

// Playwright lives in website/tools (the screenshot scripts' dependency), two
// levels up from pipeline/<feature>/. Resolved relative to this file so the
// harness runs from anywhere and survives a clone to another machine.
const require = createRequire(new URL('../../website/tools/', import.meta.url));
const { chromium, webkit } = require('playwright');

const DIST = resolve(process.argv[2]);
const MODE = process.argv[3] === '--expect-broken' ? 'broken' : 'fixed';

const TYPES = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.webp': 'image/webp', '.woff2': 'font/woff2', '.ico': 'image/x-icon',
};

const FILES_STATUS = {
  ebird: { filename: 'MyEBirdData.csv', uploadedAt: '2026-06-01T00:00:00Z' },
  ml: null,
};

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  // A backup IS stored...
  if (p === '/settings/files') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(FILES_STATUS));
  }
  // ...and its bytes will not come back. WebStorage.readFile returns null on any
  // non-ok response, which is the desktop truncated-file case's web twin.
  if (p === '/settings/files/ebird') { res.writeHead(500); return res.end('nope'); }
  if (p === '/settings/keys') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ ebird: null, openweather: null }));
  }
  if (p.startsWith('/settings/') || p.startsWith('/weather') || p.startsWith('/tide')
      || p.startsWith('/map') || p.startsWith('/taxonomy') || p.startsWith('/version')) {
    res.writeHead(404); return res.end('not found');
  }

  const file = join(DIST, p === '/' ? 'index.html' : p);
  if (existsSync(file) && statSync(file).isFile()) {
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    return res.end(readFileSync(file));
  }
  res.writeHead(200, { 'content-type': 'text/html' });
  res.end(readFileSync(join(DIST, 'index.html')));
});

const ENTRY = /list checklists with no weather blocks/i;
const SENTENCE = "Couldn't load your eBird backup. Re-upload MyEBirdData.csv in Settings → Default Files → eBird Backup.";

const failures = [];
function check(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  ${detail}` : ''}`);
  if (!ok) failures.push(name);
}

async function run(browserType, label, base) {
  const browser = await browserType.launch();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  page.setDefaultTimeout(20000);
  await page.goto(base);
  await page.waitForSelector('[role="tab"], button[aria-haspopup="listbox"]');

  const entry = page.getByRole('button', { name: ENTRY });
  await entry.waitFor();

  // ── IDLE: the region must already be in the accessibility tree, empty ──────
  const idleAlerts = page.locator('[role="alert"]');
  const idleCount = await idleAlerts.count();
  check(`${label}: an alert region exists while the section is COLLAPSED`, idleCount === 1,
    `(found ${idleCount})`);

  if (idleCount === 1) {
    const snap = await idleAlerts.first().ariaSnapshot();
    check(`${label}: the idle region reports as an alert with no name`,
      snap.trim() === '- alert', JSON.stringify(snap.trim()));

    // Nothing on the chain from the region to <html> hides it, and nothing on
    // that chain is aria-hidden -- the v0.5.83 defect is a stylesheet one and is
    // invisible to jsdom entirely.
    const chain = await idleAlerts.first().evaluate(el => {
      const out = [];
      for (let n = el; n && n !== document.documentElement.parentElement; n = n.parentElement) {
        const cs = getComputedStyle(n);
        out.push({
          tag: n.tagName, display: cs.display, visibility: cs.visibility,
          cv: cs.contentVisibility, ariaHidden: n.getAttribute('aria-hidden'),
        });
      }
      return out;
    });
    const hidden = chain.filter(n =>
      n.display === 'none' || n.visibility === 'hidden' || n.cv === 'hidden' || n.ariaHidden === 'true');
    check(`${label}: no ancestor of the idle region is hidden or aria-hidden`,
      hidden.length === 0, JSON.stringify(hidden));
  }

  if (browserType === chromium && idleCount === 1) {
    // CDP: the idle node itself, as Blink's accessibility tree sees it.
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Accessibility.enable');
    await cdp.send('DOM.enable');
    const { root } = await cdp.send('DOM.getDocument', { depth: -1, pierce: true });
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: '[role="alert"]' });
    const { nodes } = await cdp.send('Accessibility.getPartialAXTree', { nodeId, fetchRelatives: false });
    const node = nodes.find(n => n.role?.value === 'alert') ?? nodes[0];
    const live = node.properties?.find(p => p.name === 'live')?.value?.value;
    check(`${label}: CDP reports the idle region ignored:false, live:"assertive"`,
      node.ignored === false && live === 'assertive',
      `ignored=${node.ignored} live=${live}`);
  }

  // ── The message lands in that same region ─────────────────────────────────
  await entry.click();
  let landed = true;
  try {
    await page.getByText(SENTENCE).waitFor({ timeout: 15000 });
  } catch {
    landed = false;
  }
  check(`${label}: the failure message appears on expand`, landed);

  // Record what the section actually says, so a failing run reports the lie
  // rather than only the absence of the truth.
  const said = await page.getByText('Load your eBird backup first').count();
  console.log(`      (section shows the setup-shaped title: ${said === 1 ? 'YES' : 'no'})`);

  if (landed) {
    const alerts = page.locator('[role="alert"]');
    const snap = await alerts.first().ariaSnapshot();
    check(`${label}: the populated region reads as the sentence and nothing else`,
      snap.replace(/\s+/g, ' ').trim() === `- alert: ${SENTENCE}`.replace(/\s+/g, ' ').trim(),
      JSON.stringify(snap.trim()));

    // The lie this fix removes must be gone, and the way out must be there.
    check(`${label}: the setup-shaped title is not shown`,
      await page.getByText('Load your eBird backup first').count() === 0);
    const gts = await page.getByRole('button', { name: /Go to Settings/ }).all();
    const inFrame = [];
    for (const h of gts) inFrame.push(await h.evaluate(e => !!e.closest('.sr-tab-load-alert-frame')));
    check(`${label}: a Go to Settings button is offered beside the sentence`,
      inFrame.filter(Boolean).length === 1,
      `(${gts.length} on the page, ${inFrame.filter(Boolean).length} in the alert frame)`);

    // Collapse, then re-expand: the region must survive the panel's unmount.
    await entry.click();
    await page.getByText(SENTENCE).waitFor({ state: 'detached' });
    check(`${label}: the region survives a collapse, empty`,
      (await page.locator('[role="alert"]').count()) === 1
      && (await page.locator('[role="alert"]').first().ariaSnapshot()).trim() === '- alert');
    await entry.click();
    await page.getByText(SENTENCE).waitFor();
    check(`${label}: the message returns on re-expand`, true);

    // The narrow/large-text probe jsdom cannot do. `MyEBirdData.csv` is an
    // unbreakable run and this box is a flex item, so its automatic minimum size
    // is floored by it unless `sr-wrap-anywhere` lowers min-content -- the exact
    // shape that leaked page scroll on the eight tabs at 320px / 200%.
    await page.setViewportSize({ width: 320, height: 800 });
    await page.evaluate(() => { try { localStorage.setItem('sr-text-scale', '2'); } catch { /* private */ } });
    await page.reload();
    await page.getByRole('button', { name: ENTRY }).click();
    await page.getByText(SENTENCE).waitFor();
    const overflow = await page.evaluate(() => ({
      doc: document.documentElement.scrollWidth,
      win: window.innerWidth,
      box: (() => {
        const el = document.querySelector('.sr-tab-load-alert');
        const r = el.getBoundingClientRect();
        return { right: Math.round(r.right), width: Math.round(r.width) };
      })(),
    }));
    check(`${label}: no page horizontal scroll at 320px / 200% text`,
      overflow.doc <= overflow.win,
      `docScrollWidth=${overflow.doc} innerWidth=${overflow.win} box=${JSON.stringify(overflow.box)}`);
    await page.setViewportSize({ width: 1280, height: 900 });
  }

  await browser.close();
}

await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}`;
console.log(`serving ${DIST} at ${base} (mode: expect-${MODE})\n`);

try {
  await run(chromium, 'chromium', base);
  console.log('');
  await run(webkit, 'webkit', base);
} finally {
  server.close();
}

console.log('');
if (MODE === 'fixed') {
  console.log(failures.length === 0 ? 'ALL CHECKS PASSED' : `FAILURES: ${failures.join(' | ')}`);
  process.exit(failures.length === 0 ? 0 : 1);
} else {
  console.log(failures.length > 0
    ? `HARNESS DISCRIMINATES: ${failures.length} check(s) failed on the pre-fix build`
    : 'HARNESS IS VACUOUS: the pre-fix build passed every check');
  process.exit(failures.length > 0 ? 0 : 1);
}
