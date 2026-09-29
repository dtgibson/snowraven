// The species-link marks in the capture scripts (screenshot-tool-ebird-icon):
// the committed copies load, a missing or wrong copy refuses the capture, the
// init script substitutes both ways an <img> gets a src without a request, the
// frame check fails a fallback glyph or a 0px image, and every frame is checked.
import assert from 'node:assert/strict';
import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import sharp from 'sharp';
import { SITE_MARKS, loadSiteMarks, installSiteMarks, assertMarksInFrame, MarksInFrameError } from './capture-lib.mjs';

const MARKS = fileURLToPath(new URL('./marks/', import.meta.url));

test('the committed copies load as images for exactly the two URLs the app requests', async () => {
  const { byUrl } = loadSiteMarks();
  const app = await readFile(new URL('../../frontend/src/components/SpeciesLinks.tsx', import.meta.url), 'utf8');
  const appUrls = [...app.matchAll(/faviconSrc="([^"]+)"/g)].map(m => m[1]).sort();
  assert.deepEqual(appUrls, ['https://birdsoftheworld.org/favicon.ico', 'https://ebird.org/favicon.ico']);
  assert.deepEqual(Object.keys(byUrl).sort(), appUrls);
  assert.match(byUrl['https://ebird.org/favicon.ico'], /^data:image\/png;base64,/);
  assert.match(byUrl['https://birdsoftheworld.org/favicon.ico'], /^data:image\/x-icon;base64,/);
});

test('a missing copy, or an HTML page in its place, refuses the capture by name', () => {
  const [ebird, bow] = SITE_MARKS;
  const missing = mkdtempSync(join(tmpdir(), 'sr-marks-'));
  const refusal = mkdtempSync(join(tmpdir(), 'sr-marks-'));
  try {
    copyFileSync(join(MARKS, bow.file), join(missing, bow.file));
    assert.throws(() => loadSiteMarks(missing), (e) => {
      assert.match(e.message, /^Refusing to capture/);
      assert.ok(e.message.includes(`${join(missing, ebird.file)} is missing`), e.message);
      assert.ok(!e.message.includes(`${join(missing, bow.file)} is`), 'the present copy is not reported');
      assert.match(e.message, /git checkout -- website\/tools\/marks\//);
      return true;
    });
    // What an honest re-fetch would store if a bot filter refused it.
    copyFileSync(join(MARKS, bow.file), join(refusal, bow.file));
    writeFileSync(join(refusal, ebird.file), '<!doctype html><title>Access Denied</title>');
    assert.throws(() => loadSiteMarks(refusal), /ebird-favicon\.ico is not an image \(it is an HTML page, not the icon\)/);
  } finally {
    rmSync(missing, { recursive: true, force: true });
    rmSync(refusal, { recursive: true, force: true });
  }
});

test('in a real engine: both src paths are substituted with no request, and the frame check tells marks from glyphs', async () => {
  const hits = [];
  const server = createServer((req, res) => {
    if (req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><body></body>');
      return;
    }
    hits.push(req.url); // any request here means the substitution missed
    res.writeHead(404).end();
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const origin = `http://127.0.0.1:${server.address().port}`;
  // Stand-ins keyed on LOOPBACK URLs, so even a broken substitution cannot
  // send this test to eBird or Birds of the World.
  const png = await sharp({ create: { width: 48, height: 48, channels: 4, background: '#2a6' } }).png().toBuffer();
  const dataUrl = `data:image/png;base64,${png.toString('base64')}`;
  const viaAttribute = `${origin}/via-attribute.ico`;
  const viaProperty = `${origin}/via-property.ico`;

  const browser = await chromium.launch({ headless: true });
  try {
    const ctx = await browser.newContext({ viewport: { width: 400, height: 300 } });
    await installSiteMarks(ctx, { byUrl: { [viaAttribute]: dataUrl, [viaProperty]: dataUrl } });
    const p = await ctx.newPage();
    await p.goto(origin);
    // The SpeciesLinks shape: a labelled anchor around a 14px slot and a lazy img.
    const addSlot = (how, url) => p.evaluate(([how, url]) => {
      const a = document.createElement('a');
      a.setAttribute('aria-label', `mark set by ${how}`);
      a.style.display = 'block'; // one mark per row, so a clip can exclude the last
      const slot = document.createElement('span');
      slot.className = 'sr-favicon-slot';
      slot.style.cssText = 'display:inline-flex;width:14px;height:14px';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.width = 14; img.height = 14;
      if (how === 'attribute') img.setAttribute('src', url);
      else if (how === 'property') img.src = url;
      else if (how === 'broken') img.src = 'data:image/png;base64,AAAA';
      slot.append(img);
      if (how === 'glyph') slot.append(document.createElementNS('http://www.w3.org/2000/svg', 'svg'));
      a.append(slot);
      document.body.append(a);
    }, [how, url]);

    await addSlot('attribute', viaAttribute);
    await addSlot('property', viaProperty);
    assert.equal(await assertMarksInFrame(p), 2);
    const srcs = await p.$$eval('img', imgs => imgs.map(i => [i.naturalWidth, i.currentSrc.slice(0, 22)]));
    assert.deepEqual(srcs, [[48, 'data:image/png;base64,'], [48, 'data:image/png;base64,']]);
    assert.deepEqual(hits, []);

    // A frame that excludes a bad mark passes; one that includes it fails.
    await addSlot('glyph', `${origin}/unused.ico`);
    await assert.rejects(assertMarksInFrame(p), (e) =>
      e instanceof MarksInFrameError && /^1 of 3 species marks.*mark set by glyph: fallback glyph$/.test(e.message));
    const glyphTop = await p.$eval('a:last-child .sr-favicon-slot', s => s.getBoundingClientRect().top);
    assert.equal(await assertMarksInFrame(p, { x: 0, y: 0, width: 400, height: glyphTop - 1 }), 2);

    await p.evaluate(() => document.querySelector('a:last-child').remove());
    await addSlot('broken');
    await assert.rejects(assertMarksInFrame(p), /mark set by broken: image is 0px wide/);
    await ctx.close();
  } finally {
    await browser.close();
    server.close();
  }
});

test('every frame both scripts write is checked first, and makePage always serves the marks', async () => {
  const code = async (f) => (await readFile(new URL(f, import.meta.url), 'utf8'))
    .split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
  for (const f of ['./capture.mjs', './capture-appstore.mjs']) {
    const src = await code(f);
    const shots = [...src.matchAll(/await p\.screenshot\(/g)].map(m => m.index);
    assert.ok(shots.length >= 1, `${f} writes frames`);
    let from = 0;
    for (const at of shots) {
      const check = src.lastIndexOf('await assertMarksInFrame(', at);
      assert.ok(check >= from, `${f}: the screenshot at offset ${at} is not preceded by its own assertMarksInFrame`);
      from = at;
    }
    assert.match(src, /^loadSiteMarks\(\);$/m, `${f} refuses before the browser starts`);
  }
  const capture = await code('./capture.mjs');
  assert.equal(capture.match(/if \(e instanceof MarksInFrameError\) requiredFailures\.push\(/g)?.length, 2,
    'both non-required catch sites in capture.mjs promote a mark failure to a run failure');
  const lib = await code('./capture-lib.mjs');
  const make = lib.slice(lib.indexOf('export async function makePage'), lib.indexOf('\n}\n', lib.indexOf('export async function makePage')));
  const load = make.indexOf('loadSiteMarks()');
  const context = make.indexOf('browser.newContext(');
  const install = make.indexOf('installSiteMarks(ctx, marks)');
  const page = make.indexOf('ctx.newPage()');
  assert.ok(load >= 0 && load < context && context < install && install < page,
    'makePage loads the marks before opening a context and installs them before the first page');
});
