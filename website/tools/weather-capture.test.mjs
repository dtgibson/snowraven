import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import {
  applyCaptureExitCode,
  requireWeatherCaptureReady,
  runRequiredCapture,
  waitForWeatherCaptureReady,
  weatherCaptureState,
} from './weather-capture.mjs';

const WEATHER = 'Weather output\nSunset: 8:23pm';
const TIDE = 'Tide output\nStation: Beach Channel';

// Return the end of one named call while respecting the nested callback and
// options object inside it. This keeps the wiring guard structural without
// taking a broad snapshot of capture.mjs.
function callEnd(source, name, from = 0) {
  const start = source.indexOf(`${name}(`, from);
  if (start < 0) return -1;

  let depth = 0;
  let quote = null;
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = start + name.length; i < source.length; i += 1) {
    const char = source[i];
    const next = source[i + 1];
    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') { blockComment = false; i += 1; }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = null;
      continue;
    }
    if (char === '/' && next === '/') { lineComment = true; i += 1; continue; }
    if (char === '/' && next === '*') { blockComment = true; i += 1; continue; }
    if (char === '"' || char === "'" || char === '`') { quote = char; continue; }
    if (char === '(') depth += 1;
    if (char === ')' && --depth === 0) return i + 1;
  }
  return -1;
}

test('readiness requires completed Weather and Tide output', () => {
  assert.deepEqual(weatherCaptureState(`${WEATHER}\n${TIDE}`), { status: 'complete' });
  assert.deepEqual(weatherCaptureState(WEATHER), { status: 'incomplete', missing: 'Tide' });
  assert.deepEqual(weatherCaptureState(TIDE), { status: 'incomplete', missing: 'Weather' });
  assert.deepEqual(
    weatherCaptureState(`Looking up…\n${WEATHER}\n${TIDE}`),
    { status: 'loading' },
  );
  assert.deepEqual(
    weatherCaptureState(`Loading tide…\n${WEATHER}\n${TIDE}`),
    { status: 'loading' },
  );
});

test('missing-key and unavailable states are terminal failures', () => {
  for (const text of [
    'OpenWeather API key not configured.',
    'Weather data unavailable for this checklist.',
    'Tide data unavailable right now.',
    // A checklist whose own eBird date cannot be read (at-route-try-containment).
    "This checklist's date could not be read.",
  ]) {
    assert.equal(weatherCaptureState(text).status, 'error', text);
    assert.throws(() => requireWeatherCaptureReady(text), /reached an error state/);
  }
});

test('the final-frame guard rejects loading and either partial result', () => {
  assert.throws(() => requireWeatherCaptureReady('Looking up…'), /still loading/);
  assert.throws(() => requireWeatherCaptureReady(WEATHER), /Tide output is missing/);
  assert.throws(() => requireWeatherCaptureReady(TIDE), /Weather output is missing/);
  assert.doesNotThrow(() => requireWeatherCaptureReady(`${WEATHER}\n${TIDE}`));
});

test('the wait survives partial output but resolves only after both results arrive', async () => {
  const frames = ['Looking up…', TIDE, `${WEATHER}\n${TIDE}`];
  let index = 0;
  let clock = 0;
  await waitForWeatherCaptureReady(
    async () => frames[Math.min(index++, frames.length - 1)],
    {
      timeoutMs: 1_000,
      pollMs: 10,
      now: () => clock,
      sleep: async ms => { clock += ms; },
    },
  );
  assert.equal(index, 3);
});

test('a partial Tide-only frame times out instead of being accepted', async () => {
  let clock = 0;
  await assert.rejects(
    waitForWeatherCaptureReady(
      async () => TIDE,
      {
        timeoutMs: 20,
        pollMs: 10,
        now: () => clock,
        sleep: async ms => { clock += ms; },
      },
    ),
    /timed out after 20ms: Weather output was missing/,
  );
});

test('a required Weather capture failure sets a nonzero command result', async () => {
  const logs = [];
  const failure = await runRequiredCapture(
    'weather-light.png',
    async () => { throw new Error('still loading'); },
    (...parts) => logs.push(parts.join(' ')),
  );
  const runtime = { exitCode: undefined };

  assert.equal(failure, 'weather-light.png: still loading');
  assert.deepEqual(logs, ['FAIL weather-light.png still loading']);
  assert.equal(applyCaptureExitCode([failure], runtime), 1);
  assert.equal(runtime.exitCode, 1);
});

test('a successful required capture keeps the command result clean', async () => {
  const failure = await runRequiredCapture('weather-light.png', async () => {});
  const runtime = { exitCode: undefined };

  assert.equal(failure, null);
  assert.equal(applyCaptureExitCode([], runtime), 0);
  assert.equal(runtime.exitCode, undefined);
});

test('capture.mjs keeps every fail-closed Weather call site wired in order', async () => {
  const source = await readFile(new URL('./capture.mjs', import.meta.url), 'utf8');
  const weatherStart = source.indexOf('// Weather + Tide');
  const browserClose = source.indexOf('await browser.close();', weatherStart);
  assert.ok(weatherStart >= 0 && browserClose > weatherStart, 'the scoped Weather capture block must exist');

  const weather = source.slice(weatherStart, browserClose);
  const waitStart = weather.indexOf('waitForWeatherCaptureReady(');
  const waitEnd = callEnd(weather, 'waitForWeatherCaptureReady');
  const stripStart = weather.indexOf('await p.evaluate(', waitEnd);
  const finalStart = weather.indexOf('requireWeatherCaptureReady(', stripStart);
  const finalEnd = callEnd(weather, 'requireWeatherCaptureReady', stripStart);
  const screenshotStart = weather.indexOf('await p.screenshot(', finalEnd);

  assert.ok(waitStart >= 0 && waitEnd > waitStart, 'the bounded readiness wait must be called');
  assert.match(weather.slice(Math.max(0, waitStart - 12), waitStart), /await\s*$/);
  assert.match(
    weather.slice(waitEnd),
    /^\s*;/,
    'the readiness wait must be awaited directly; a chained .catch would swallow failure',
  );
  assert.ok(stripStart > waitEnd, 'attribution cleanup must follow the readiness wait');
  assert.ok(finalStart > stripStart && finalEnd > finalStart, 'the final readiness recheck must follow cleanup');
  assert.ok(screenshotStart > finalEnd, 'the screenshot must be written only after the final recheck');
  assert.match(
    weather,
    /if\s*\(\s*weatherFailure\s*\)\s*requiredFailures\.push\(\s*weatherFailure\s*\)\s*;/,
    'the required Weather failure must enter the command-level failure collection',
  );

  const completion = source.slice(browserClose);
  const failureGuard = completion.search(/if\s*\(\s*requiredFailures\.length\s*\)\s*\{/);
  const failureBanner = completion.indexOf('CAPTURE FAILED');
  const elseBranch = completion.indexOf('} else {', failureBanner);
  const successBanner = completion.indexOf('CAPTURE DONE');
  const exitStatus = completion.indexOf('applyCaptureExitCode(requiredFailures)');
  assert.ok(
    failureGuard >= 0
      && failureBanner > failureGuard
      && elseBranch > failureBanner
      && successBanner > elseBranch
      && exitStatus > successBanner,
    'failure reporting, exclusive success reporting, and exit status must remain ordered',
  );
  assert.equal(source.match(/CAPTURE DONE/g)?.length, 1, 'there must be one success banner, only in the no-failure branch');
});

// THE SIZE IS DERIVED FROM BOTH SIDES, NEVER TYPED IN. The Weather figure in
// ../index.html declares a width and a height so the browser reserves its box
// before the image arrives, and the asset must be exactly that size. This row
// reads the asset's real size with sharp and compares it to the size the markup
// declares: two declarations of one number, held to each other. It used to
// restate the size as a literal, and when the approved 1.0.33 reframe
// (website-screenshot-sizing, `bbb2c6b`) recaptured the shot at 16:9 and
// updated the markup with it, the literal stayed behind and the row sat red. A
// recapture that lands with its markup now keeps it green; an asset and a
// declaration that disagree turn it red, whichever of the two moved.
//
// THE ALT IS CHECKED FOR PRESENCE, NOT WORDING. The figure's alt is approved
// published copy: the user approved the current one at the 1.0.33 sign-off,
// when the reframed shot stopped showing the tide (DECISIONS.md, v1.0.33). Its
// words belong to that approval, not to this file, and a phrase pinned here is
// one more copy of published prose to go stale unseen, which is what "a tide
// block" did. So the row asks only that the figure's image carries a non-empty
// alt, which no approved wording can turn red.
//
// OVERLAP, ON PURPOSE. frontend/src/lib/websiteFigureDimensions.test.ts holds
// every figure's declared size to its file in CI, by parsing WebP headers in
// pure JS. This row is the independent sharp-side read of the same claim for
// the Weather figure, through the library that writes the asset
// (process-img.mjs), kept beside the capture code it belongs to. Neither suite
// pins the alt's wording.
test('the published Weather asset and its scoped markup declare the same size', async () => {
  const ASSET = 'assets/shots/weather.webp';
  const metadata = await sharp(fileURLToPath(new URL(`../${ASSET}`, import.meta.url))).metadata();
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const figure = html.match(/<figure class="feature-media shot-slot" data-shot="weather">([\s\S]*?)<\/figure>/)?.[1];

  assert.ok(figure, 'the Weather screenshot figure must exist');
  const img = figure.match(/<img\b[^>]*>/)?.[0];
  assert.ok(img, 'the Weather figure must carry an <img>');
  assert.equal(img.match(/\bsrc="([^"]*)"/)?.[1], ASSET, 'the Weather figure must show the asset this row reads');

  const declared = {
    width: Number(img.match(/\bwidth="(\d+)"/)?.[1]),
    height: Number(img.match(/\bheight="(\d+)"/)?.[1]),
  };
  assert.ok(
    Number.isInteger(declared.width) && declared.width > 0 && Number.isInteger(declared.height) && declared.height > 0,
    `the Weather <img> must declare a positive integer width and height, read ${JSON.stringify(declared)}`,
  );
  assert.ok(metadata.width > 0 && metadata.height > 0, 'sharp must read a real size from the Weather asset');
  assert.deepEqual(
    { width: metadata.width, height: metadata.height },
    declared,
    `${ASSET} is ${metadata.width}x${metadata.height} but index.html declares ${declared.width}x${declared.height}`,
  );
  // Capture the value and test it, rather than matching `alt="...\S..."` in
  // place: `\S` also matches the closing quote, so an empty alt followed by any
  // other attribute would satisfy an in-place match.
  assert.ok(img.match(/\balt="([^"]*)"/)?.[1].trim(), 'the Weather <img> must carry a non-empty alt');
});
