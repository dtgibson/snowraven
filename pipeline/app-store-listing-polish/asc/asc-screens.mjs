#!/usr/bin/env node
// SnowRaven App Store screenshot replacement (app-store-listing-polish).
//
// Commands (every write needs --execute; without it the command is a dry run):
//   plan     --loc <localizationId>                 read-only survey + what replace would do
//   replace  --loc <id> --family <fam> [--via legacy|library] [--execute]
//   readback --loc <id> [--family <fam>] [--dir <root>] [--order 01,02,...]   read-only verification
//
// Frames are read from <root>/appstore/screenshots/<family>/, where <root> is
// this repo (three levels up) unless --dir names another tree. --order is only
// for checking a set uploaded in a different order (1.0.60 holds 01 to 06).
// Credentials: asc-lib.mjs (key QJA25M7XHM, issuer from APPLE_API_ISSUER_ID).
//
// Families and their store slots:
//   iphone-6.9  legacy APP_IPHONE_67          | library IPHONE_DYNAMIC_ISLAND_LARGE_PROFILE
//   ipad-13     legacy APP_IPAD_PRO_3GEN_129  | library IPAD_13_PROFILE
//   iphone-duo  (no legacy display type)      | library IPHONE_DUO_PROFILE
// Default route: legacy for iphone-6.9 and ipad-13 (it keeps the md5
// sourceFileChecksum read-back, v1.0.29), library for iphone-duo (the only
// route: API 4.5.1 added the Duo only to the App Asset Library).
//
// A set is replaced WHOLE and IN ORDER (v1.0.4): every existing screenshot in
// the slot is removed, then the six frames go up in FRAMES order, then the
// order is pinned explicitly. Read-back: order by position, file name, byte
// size, spec/dimensions, delivery state, md5 where the API has one, and a
// decoded-pixel comparison of Apple's processed PNG against the local file
// (measured exact on 1.0.60's iPhone 01: 0 of 11,357,280 values differ).
import { createHash } from 'node:crypto';
import { readFileSync, statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { api, get, getAll, short } from './asc-lib.mjs';

// The repo root, three levels above this file (pipeline/app-store-listing-polish/asc/).
const REPO = fileURLToPath(new URL('../../../', import.meta.url)).replace(/\/$/, '');
const APP = '6787719977';
// Upload order: FRAMES in website/tools/compose-appstore.mjs.
const ORDER = ['01-map-explorer', '02-statistics', '04-calendar', '05-species-detail', '03-weather-tide', '06-breeding-codes'];
const FAMILIES = {
  'iphone-6.9': { legacy: 'APP_IPHONE_67', group: 'IPHONE_DYNAMIC_ISLAND_LARGE_PROFILE', w: 1320, h: 2868, via: 'legacy' },
  'ipad-13': { legacy: 'APP_IPAD_PRO_3GEN_129', group: 'IPAD_13_PROFILE', w: 2064, h: 2752, via: 'legacy' },
  'iphone-duo': { legacy: null, group: 'IPHONE_DUO_PROFILE', w: 2007, h: 2853, via: 'library' },
};
const EDITABLE = new Set(['PREPARE_FOR_SUBMISSION', 'DEVELOPER_REJECTED', 'REJECTED', 'METADATA_REJECTED', 'INVALID_BINARY']);

const args = process.argv.slice(2);
const cmd = args[0];
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const EXECUTE = args.includes('--execute');
const LOC = opt('loc');
const ROOT = opt('dir') ?? REPO;
// --order 01,02,03,... overrides the upload order (read-back exercises only).
const ORDER_USED = opt('order')
  ? opt('order').split(',').map((p) => ORDER.find((n) => n.startsWith(p)) ?? (() => { throw new Error(`--order: no frame ${p}`); })())
  : ORDER;

function files(fam) {
  return ORDER_USED.map((name, i) => {
    const path = `${ROOT}/appstore/screenshots/${fam}/${name}.png`;
    const buf = readFileSync(path);
    return { position: i + 1, name: `${name}.png`, path, size: statSync(path).size, md5: createHash('md5').update(buf).digest('hex'), buf };
  });
}

async function must(method, path, body) {
  if (!EXECUTE && method !== 'GET') {
    console.log(`  DRY-RUN ${method} ${path}${body ? ' ' + JSON.stringify(body).slice(0, 300) : ''}`);
    return { dry: true, json: { data: { id: `dry-${Math.random().toString(16).slice(2, 10)}`, attributes: {} } } };
  }
  const r = await api(method, path, body);
  if (!r.ok) throw new Error(`${method} ${path} -> ${r.status} ${JSON.stringify(r.json?.errors ?? r.json).slice(0, 1200)}`);
  return r;
}

async function versionOf(loc) {
  const j = await get(`/v1/appStoreVersionLocalizations/${loc}?include=appStoreVersion&fields[appStoreVersions]=versionString,appStoreState,appVersionState`);
  const v = (j.included ?? [])[0];
  return { locale: j.data.attributes.locale, id: v?.id, ...v?.attributes };
}

async function putParts(ops, buf) {
  for (const op of ops) {
    const headers = Object.fromEntries((op.requestHeaders ?? []).map((h) => [h.name, h.value]));
    const res = await fetch(op.url, { method: op.method, headers, body: buf.subarray(op.offset, op.offset + op.length) });
    if (!res.ok) throw new Error(`upload part at ${op.offset} -> ${res.status}`);
  }
}

async function poll(path, done, failed, label) {
  for (let i = 0; i < 90; i++) {
    const j = await get(path);
    const s = done.state(j);
    if (done.ok(s)) return j;
    if (failed(s)) throw new Error(`${label}: ${s} ${JSON.stringify(j.data.attributes.assetDeliveryState?.errors ?? j.data.attributes.stateDetails ?? '')}`);
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error(`${label}: still processing after 6 minutes`);
}

// ---------- legacy (appScreenshotSets / appScreenshots) ----------
async function legacySets(loc) {
  return getAll(`/v1/appStoreVersionLocalizations/${loc}/appScreenshotSets?limit=50`);
}
async function legacyShots(setId) {
  return getAll(`/v1/appScreenshotSets/${setId}/appScreenshots?limit=50`);
}

async function replaceLegacy(loc, fam) {
  const F = FAMILIES[fam];
  const local = files(fam);
  let set = (await legacySets(loc)).find((s) => s.attributes.screenshotDisplayType === F.legacy);
  if (!set) {
    console.log(`  set ${F.legacy} absent: create`);
    const r = await must('POST', '/v1/appScreenshotSets', {
      data: { type: 'appScreenshotSets', attributes: { screenshotDisplayType: F.legacy }, relationships: { appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc } } } },
    });
    set = r.json.data;
  }
  const existing = set.id.startsWith('dry-') ? [] : await legacyShots(set.id);
  console.log(`  set ${short(set.id)} ${F.legacy}: ${existing.length} existing screenshot(s) to delete`);
  for (const sh of existing) await must('DELETE', `/v1/appScreenshots/${sh.id}`);
  const ids = [];
  for (const f of local) {
    console.log(`  [${f.position}] ${f.name} ${f.size}B md5=${f.md5}`);
    const r = await must('POST', '/v1/appScreenshots', {
      data: { type: 'appScreenshots', attributes: { fileName: f.name, fileSize: f.size }, relationships: { appScreenshotSet: { data: { type: 'appScreenshotSets', id: set.id } } } },
    });
    const id = r.json.data.id;
    if (EXECUTE) await putParts(r.json.data.attributes.uploadOperations ?? [], f.buf);
    else console.log(`  DRY-RUN PUT ${f.size} bytes over the returned uploadOperations`);
    await must('PATCH', `/v1/appScreenshots/${id}`, { data: { type: 'appScreenshots', id, attributes: { uploaded: true, sourceFileChecksum: f.md5 } } });
    if (EXECUTE) {
      await poll(`/v1/appScreenshots/${id}`, { state: (j) => j.data.attributes.assetDeliveryState?.state, ok: (s) => s === 'COMPLETE' }, (s) => s === 'FAILED', f.name);
      console.log(`      COMPLETE ${short(id)}`);
    }
    ids.push(id);
  }
  await must('PATCH', `/v1/appScreenshotSets/${set.id}/relationships/appScreenshots`, { data: ids.map((id) => ({ type: 'appScreenshots', id })) });
}

// ---------- App Asset Library (API 4.5.1) ----------
async function libraryId() {
  return (await get(`/v1/apps/${APP}/assetLibrary`)).data.id;
}
async function placements(loc, group) {
  const j = await get(`/v1/appStoreVersionLocalizations/${loc}/placements?limit=50&sort=placementGroupPosition&include=image&filter[placementGroup]=${group}&filter[placementType]=APP_SCREENSHOT`);
  const imgs = Object.fromEntries((j.included ?? []).map((i) => [i.id, { id: i.id, ...i.attributes }]));
  return j.data.map((p) => ({ id: p.id, ...p.attributes, image: imgs[p.relationships?.image?.data?.id] }));
}
async function specIdFor(fam) {
  const F = FAMILIES[fam];
  const rd = (await get('/v1/appAssetLibraryRefData')).data[0].attributes;
  const spec = rd.imageSpecs.find((s) => s.dimensions.minWidth === F.w && s.dimensions.maxWidth === F.w && s.dimensions.minHeight === F.h && s.dimensions.maxHeight === F.h && s.compatiblePlacementTypes.includes('APP_SCREENSHOT'));
  const mapped = rd.placementTypes.find((p) => p.placementTypeId === 'APP_SCREENSHOT').specMappings.find((m) => m.placementGroupId === F.group);
  if (!spec) throw new Error(`no image spec for ${F.w}x${F.h}`);
  if (!mapped?.specs.includes(spec.specId)) throw new Error(`spec ${spec.shortName} is not mapped to ${F.group}`);
  if (spec.alphaAllowed !== false) console.log(`  note: ${spec.shortName} alphaAllowed=${spec.alphaAllowed}`);
  return spec;
}

async function replaceLibrary(loc, fam) {
  const F = FAMILIES[fam];
  const local = files(fam);
  const lib = await libraryId();
  const spec = await specIdFor(fam);
  console.log(`  library ${lib}; group ${F.group}; expected spec ${spec.shortName} (${spec.specId})`);
  const existing = await placements(loc, F.group);
  console.log(`  ${existing.length} existing placement(s) in ${F.group} to delete (assets stay in the library)`);
  for (const p of existing) await must('DELETE', `/v1/appAssetLibraryPlacements/${p.id}`);
  const placed = [];
  for (const f of local) {
    console.log(`  [${f.position}] ${f.name} ${f.size}B md5=${f.md5}`);
    const r = await must('POST', '/v1/appAssetLibraryImages', {
      data: {
        type: 'appAssetLibraryImages',
        attributes: { category: 'APP_SCREENSHOTS_AND_PREVIEWS', fileName: f.name, fileSize: f.size, referenceName: `${fam} ${f.name}` },
        relationships: { assetLibrary: { data: { type: 'appAssetLibraries', id: lib } } },
      },
    });
    const id = r.json.data.id;
    if (EXECUTE) await putParts(r.json.data.attributes.uploadOperations ?? [], f.buf);
    else console.log(`  DRY-RUN PUT ${f.size} bytes over the returned uploadOperations`);
    await must('PATCH', `/v1/appAssetLibraryImages/${id}`, { data: { type: 'appAssetLibraryImages', id, attributes: { uploaded: true } } });
    if (EXECUTE) {
      const j = await poll(
        `/v1/appAssetLibraryImages/${id}`,
        { state: (x) => x.data.attributes.state, ok: (s) => !['AWAITING_UPLOAD', 'UPLOAD_COMPLETE', 'FAILED'].includes(s) },
        (s) => s === 'FAILED',
        f.name,
      );
      if (j.data.attributes.specId !== spec.specId) throw new Error(`${f.name}: matched spec ${j.data.attributes.specId}, expected ${spec.specId}`);
      console.log(`      ${j.data.attributes.state} spec ok ${short(id)}`);
    }
    const p = await must('POST', '/v1/appAssetLibraryPlacements', {
      data: {
        type: 'appAssetLibraryPlacements',
        attributes: { placementType: 'APP_SCREENSHOT', placementGroup: F.group },
        relationships: { image: { data: { type: 'appAssetLibraryImages', id } }, appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc } } },
      },
    });
    placed.push(p.json.data.id);
  }
  await must('POST', '/v1/appAssetLibraryPlacementOrderingRequests', {
    data: {
      type: 'appAssetLibraryPlacementOrderingRequests',
      attributes: { placementGroup: F.group },
      relationships: { orderedPlacements: { data: placed.map((id) => ({ type: 'appAssetLibraryPlacements', id })) }, appStoreVersionLocalization: { data: { type: 'appStoreVersionLocalizations', id: loc } } },
    },
  });
}

// ---------- read-back ----------
let sharp = null;
async function pixelsEqual(templateUrl, w, h, localBuf) {
  if (!sharp) sharp = createRequire(`${REPO}/website/tools/package.json`)('sharp');
  const url = templateUrl.replace('{w}', String(w)).replace('{h}', String(h)).replace('{f}', 'png');
  const res = await fetch(url);
  if (!res.ok) return `fetch ${res.status}`;
  const remote = Buffer.from(await res.arrayBuffer());
  const dec = (b) => sharp(b).removeAlpha().toColourspace('srgb').raw().toBuffer({ resolveWithObject: true });
  const [a, b] = await Promise.all([dec(localBuf), dec(remote)]);
  if (a.info.width !== b.info.width || a.info.height !== b.info.height) return `size ${b.info.width}x${b.info.height}`;
  let diff = 0;
  for (let i = 0; i < a.data.length; i++) if (a.data[i] !== b.data[i]) diff++;
  return diff === 0 ? true : `${diff} values differ`;
}

async function readback(loc, fams) {
  let bad = 0;
  const sets = await legacySets(loc);
  for (const fam of fams) {
    const F = FAMILIES[fam];
    const local = files(fam);
    const pl = await placements(loc, F.group);
    const legacy = F.legacy ? sets.find((s) => s.attributes.screenshotDisplayType === F.legacy) : null;
    const lshots = legacy ? await legacyShots(legacy.id) : [];
    console.log(`\n${fam} (${F.group}${F.legacy ? ' / ' + F.legacy : ''}): ${pl.length} placement(s), legacy set ${legacy ? short(legacy.id) + ' with ' + lshots.length : 'none'}`);
    if (pl.length !== local.length) {
      console.log(`  FAIL count ${pl.length}, expected ${local.length}`);
      bad++;
    }
    for (let i = 0; i < Math.max(pl.length, local.length); i++) {
      const p = pl[i];
      const f = local[i];
      if (!p || !f) {
        console.log(`  [${i + 1}] FAIL missing ${p ? 'local' : 'remote'}`);
        bad++;
        continue;
      }
      const im = p.image ?? {};
      const ls = lshots[i]?.attributes;
      const checks = {
        name: im.fileName === f.name,
        size: im.fileSize === f.size,
        dims: im.imageAsset?.width === F.w && im.imageAsset?.height === F.h,
        md5: ls ? ls.sourceFileChecksum === f.md5 && ls.fileName === f.name : 'n/a',
        delivery: ls ? ls.assetDeliveryState?.state === 'COMPLETE' : im.state,
        pixels: im.imageAsset?.templateUrl ? await pixelsEqual(im.imageAsset.templateUrl, F.w, F.h, f.buf) : 'no templateUrl',
      };
      const ok = checks.name && checks.size && checks.dims && checks.md5 !== false && checks.delivery !== false && checks.pixels === true;
      if (!ok) bad++;
      console.log(`  [${i + 1}] ${ok ? 'OK  ' : 'FAIL'} ${f.name} ${JSON.stringify(checks)} placement=${p.state}`);
    }
  }
  console.log(`\nread-back: ${bad === 0 ? 'ALL MATCH' : bad + ' problem(s)'}`);
  return bad;
}

// ---------- main ----------
if (!LOC) throw new Error('--loc <appStoreVersionLocalization id> is required');
const v = await versionOf(LOC);
console.log(`localization ${short(LOC)} ${v.locale} on version ${v.versionString} (${short(v.id)}) appStoreState=${v.appStoreState} appVersionState=${v.appVersionState}`);
const editable = EDITABLE.has(v.appStoreState);
console.log(`editable: ${editable}${EXECUTE ? '' : '  (dry run: no writes)'}`);

if (cmd === 'plan' || cmd === 'replace') {
  const famArg = opt('family');
  const fams = cmd === 'plan' ? Object.keys(FAMILIES) : [famArg];
  if (cmd === 'replace' && !FAMILIES[famArg]) throw new Error(`--family must be one of ${Object.keys(FAMILIES).join(', ')}`);
  if (EXECUTE && !editable) throw new Error(`refusing to write: version ${v.versionString} is ${v.appStoreState}, not editable`);
  if (cmd === 'plan' && EXECUTE) throw new Error('plan never writes');
  for (const fam of fams) {
    const via = (cmd === 'replace' && opt('via')) || FAMILIES[fam].via;
    if (via === 'legacy' && !FAMILIES[fam].legacy) throw new Error(`${fam} has no legacy display type; use --via library`);
    console.log(`\n== ${fam} via ${via}`);
    if (via === 'legacy') await replaceLegacy(LOC, fam);
    else await replaceLibrary(LOC, fam);
  }
} else if (cmd === 'readback') {
  const famArg = opt('family');
  process.exitCode = (await readback(LOC, famArg ? [famArg] : Object.keys(FAMILIES))) ? 1 : 0;
} else {
  throw new Error('command: plan | replace | readback');
}
