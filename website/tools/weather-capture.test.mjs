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

test('the published Weather asset and its scoped markup agree on 1080x2021', async () => {
  const asset = fileURLToPath(new URL('../assets/shots/weather.webp', import.meta.url));
  const metadata = await sharp(asset).metadata();
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const figure = html.match(/<figure class="feature-media shot-slot" data-shot="weather">([\s\S]*?)<\/figure>/)?.[1];

  assert.ok(figure, 'the Weather screenshot figure must exist');
  assert.equal(metadata.width, 1080);
  assert.equal(metadata.height, 2021);
  assert.match(figure, /<img src="assets\/shots\/weather\.webp" width="1080" height="2021"/);
  assert.match(figure, /formatted weather summary and a tide block/);
});
