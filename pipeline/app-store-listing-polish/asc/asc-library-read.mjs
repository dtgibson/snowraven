// Read-only survey of the App Asset Library (App Store Connect API 4.5.1):
// the screenshot placement groups and image specs for our three slots, the
// app's library, and one localization's screenshot placements in order.
// GETs only; prints to the console and writes no file.
//
// Usage: node asc-library-read.mjs --loc <appStoreVersionLocalization id>
import { api, get } from './asc-lib.mjs';

const APP = '6787719977';
const args = process.argv.slice(2);
const LOC = args.includes('--loc') ? args[args.indexOf('--loc') + 1] : null;

const rd = (await get('/v1/appAssetLibraryRefData')).data[0].attributes;
console.log('placement groups (iPhone App Store and iPad App Store):');
for (const g of rd.placementProfileGroups ?? []) {
  if (['IPHONE_APP_STORE', 'IPAD_APP_STORE'].includes(g.platform)) console.log(`  ${g.placementProfileGroupId} displayClass=${g.displayClassId}`);
}
const ours = [[1320, 2868], [2064, 2752], [2007, 2853]];
console.log('image specs for our three sizes:');
for (const s of rd.imageSpecs ?? []) {
  const d = s.dimensions ?? {};
  if (ours.some(([w, h]) => d.minWidth === w && d.maxWidth === w && d.minHeight === h && d.maxHeight === h)) {
    console.log(`  ${s.shortName} ${s.specId} alphaAllowed=${s.alphaAllowed} ${s.fileExtensions?.join(',')}`);
  }
}
for (const f of rd.features ?? []) {
  if (f.featureId !== 'APP_STORE_VERSIONS') continue;
  for (const p of f.placementPolicies ?? []) {
    if (p.placementType === 'APP_SCREENSHOT') for (const l of p.groupLimits ?? []) console.log(`APP_SCREENSHOT limit ${l.maxCount} per group (${l.groupIds.length} groups)`);
  }
}

const lib = await api('GET', `/v1/apps/${APP}/assetLibrary`);
console.log(`\nasset library: ${lib.ok ? lib.json.data.id : lib.status}`);

if (LOC) {
  const pl = await get(`/v1/appStoreVersionLocalizations/${LOC}/placements?limit=50&sort=placementGroupPosition&include=image&filter[placementType]=APP_SCREENSHOT`);
  const imgs = Object.fromEntries((pl.included ?? []).map((i) => [i.id, i.attributes]));
  console.log(`\nlocalization ${LOC}: ${pl.data.length} screenshot placement(s)`);
  for (const p of pl.data) {
    const im = imgs[p.relationships?.image?.data?.id] ?? {};
    console.log(`  ${p.attributes.placementGroup} state=${p.attributes.state} ${im.fileName} ${im.fileSize}B spec=${im.specId} asset=${im.state}`);
  }
}
