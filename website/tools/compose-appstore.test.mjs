// The App Store composer (app-store-listing-polish): every committed upload
// frame is an opaque RGB PNG at a size App Store Connect accepts for its slot,
// one per row of the frame table and nothing else, in the approved order; and
// the composer refuses a caption wider than its box, a raw of the wrong size,
// and a table App Store Connect would refuse.
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import sharp from 'sharp';
import { FAMILIES, FRAMES, MAX_FRAMES, OUT_ROOT, RAW_ROOT, checkTable, composeFamily, launchComposer } from './compose-appstore.mjs';

// Apple's accepted portrait sizes per slot, written here independently of the
// composer and the capture script (App Store Connect's screenshot
// specifications, re-verified 2026-10-30). A family whose canvas is not on its
// slot's list, or a slot with no row here, fails.
const ACCEPTED = {
  'iphone-6.9': ['1320x2868', '1290x2796', '1260x2736'],
  'ipad-13': ['2064x2752', '2048x2732'],
  'iphone-duo': ['2007x2853', '1398x2034'],
};

// The approved table, as content: upload order, raw file, display line, second
// line. The composer's FRAMES is held to these literals rather than to itself.
const APPROVED = [
  ['01-map-explorer.png', 'Map Explorer', 'Your sightings and nearby hotspots on a map'],
  ['02-statistics.png', 'Statistics', 'Life list totals, growth, and milestones'],
  ['04-calendar.png', 'Calendar', 'Each day shaded by species, checklists, media, etc.'],
  ['05-species-detail.png', 'Species Detail', 'Your whole history with one bird'],
  ['03-weather-tide.png', 'Weather', 'A weather and tide summary for a checklist'],
  ['06-breeding-codes.png', 'Breeding Codes', 'Breeding evidence by species and code'],
];

const pngsIn = (dir) => readdirSync(dir).filter(f => /\.png$/i.test(f)).sort();

test('every composed frame is an opaque RGB PNG at its slot\'s size, one per table row, in the approved order', async () => {
  assert.deepEqual(FRAMES.map(f => [f.file, f.tab, f.desc]), APPROVED, 'the frame table is the approved upload order and captions');
  assert.ok(FRAMES.length >= 1 && FRAMES.length <= MAX_FRAMES && MAX_FRAMES === 10, 'App Store Connect takes 1 to 10 frames per set');

  // Each display line is a tab's name exactly as the app spells it.
  const tabLayout = readFileSync(new URL('../../frontend/src/lib/tabLayout.ts', import.meta.url), 'utf8');
  const block = tabLayout.slice(tabLayout.indexOf('export const TAB_LABELS'), tabLayout.indexOf('\n}\n', tabLayout.indexOf('export const TAB_LABELS')));
  const labels = new Set([...block.matchAll(/'[a-z-]+':\s*'([^']+)'/g)].map(m => m[1]));
  assert.ok(labels.has('Multimedia') && labels.size >= FRAMES.length, `TAB_LABELS parsed (${[...labels].join(', ')})`);
  for (const f of FRAMES) assert.ok(labels.has(f.tab), `"${f.tab}" is not a TAB_LABELS name`);

  assert.deepEqual(FAMILIES.map(f => f.dir).sort(), Object.keys(ACCEPTED).sort(), 'every family has an accepted-size row');
  let checked = 0;
  for (const fam of FAMILIES) {
    const size = `${fam.canvas.w}x${fam.canvas.h}`;
    assert.ok(ACCEPTED[fam.dir].includes(size), `${fam.dir} canvas ${size} is not an accepted size`);
    assert.deepEqual(pngsIn(join(OUT_ROOT, fam.dir)), FRAMES.map(f => f.file).sort(), `${fam.dir} holds exactly the table's frames`);
    for (const { file } of FRAMES) {
      const out = await sharp(join(OUT_ROOT, fam.dir, file)).metadata();
      const raw = await sharp(join(RAW_ROOT, fam.dir, file)).metadata();
      const label = `${fam.dir}/${file}`;
      assert.equal(out.format, 'png', label);
      assert.equal(`${out.width}x${out.height}`, size, `${label} is the canvas size`);
      assert.equal(`${raw.width}x${raw.height}`, size, `${label}'s raw capture is the canvas size`);
      assert.equal(out.channels, 3, `${label} is RGB`);
      assert.equal(out.hasAlpha, false, `${label} has no alpha`);
      checked++;
    }
  }
  assert.equal(checked, FAMILIES.length * FRAMES.length);
});

test('the composer refuses a caption wider than its box, a raw of the wrong size, and a table outside 1 to 10', async () => {
  const iphone = FAMILIES.find(f => f.key === 'iphone');
  const first = FRAMES[0];
  assert.throws(() => checkTable([]), /holds 0 frames; App Store Connect takes 1 to 10/);
  assert.throws(() => checkTable(Array.from({ length: 11 }, (_, i) => ({ ...first, file: `${i}.png` }))), /holds 11 frames/);
  assert.throws(() => checkTable([first, first]), /names 01-map-explorer\.png twice/);

  const root = mkdtempSync(join(tmpdir(), 'sr-compose-'));
  const browser = await launchComposer();
  try {
    const rawRoot = join(root, 'raw');
    mkdirSync(join(rawRoot, iphone.dir), { recursive: true });
    copyFileSync(join(RAW_ROOT, iphone.dir, first.file), join(rawRoot, iphone.dir, first.file));
    const out = (name) => join(root, name);

    // The control: the approved caption over the same raw composes, so each
    // refusal below is the caption's doing and not the setup's.
    await composeFamily(browser, iphone, { frames: [first], rawRoot, outRoot: out('ok') });
    const ok = await sharp(join(out('ok'), iphone.dir, first.file)).metadata();
    assert.deepEqual([ok.width, ok.height, ok.channels, ok.hasAlpha], [1320, 2868, 3, false]);

    await assert.rejects(
      composeFamily(browser, iphone, { frames: [{ ...first, tab: 'Map Explorer and Every Hotspot' }], rawRoot, outRoot: out('long-tab') }),
      /the tab name "Map Explorer and Every Hotspot" is [\d.]+px wide, wider than its 936px box/);
    await assert.rejects(
      composeFamily(browser, iphone, { frames: [{ ...first, desc: `${first.desc}, with every checklist you kept` }], rawRoot, outRoot: out('long-desc') }),
      /the second line ".*" is [\d.]+px wide, wider than its 1080px box/);
    for (const name of ['long-tab', 'long-desc']) {
      const written = existsSync(out(name)) ? readdirSync(out(name), { recursive: true }).filter(f => /\.png$/.test(f)) : [];
      assert.deepEqual(written, [], `${name} wrote nothing`);
    }

    const smallRoot = join(root, 'raw-small');
    mkdirSync(join(smallRoot, iphone.dir), { recursive: true });
    await sharp({ create: { width: 100, height: 100, channels: 3, background: '#ffffff' } }).png().toFile(join(smallRoot, iphone.dir, first.file));
    await assert.rejects(
      composeFamily(browser, iphone, { frames: [first], rawRoot: smallRoot, outRoot: out('small') }),
      /iphone-6\.9\/01-map-explorer\.png is 100x100, expected 1320x2868/);
  } finally {
    await browser.close();
    rmSync(root, { recursive: true, force: true });
  }
});
