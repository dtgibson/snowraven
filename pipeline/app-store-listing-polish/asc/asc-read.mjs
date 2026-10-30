// Read-only survey of App Store Connect: the version records, one version's
// build, review submissions, en-US localization id and screenshot sets.
// GETs only; prints to the console and writes no file.
//
// Usage: node asc-read.mjs [--version 1.0.61]   (default: the newest record)
import { get, getAll, api } from './asc-lib.mjs';

const BUNDLE = 'com.dtgibson.snowraven';
const args = process.argv.slice(2);
const want = args.includes('--version') ? args[args.indexOf('--version') + 1] : null;

const app = (await get(`/v1/apps?filter[bundleId]=${BUNDLE}&fields[apps]=name,bundleId`)).data[0];
console.log(`app ${app.id} ${app.attributes.name} (${app.attributes.bundleId})`);

const versions = await getAll(
  `/v1/apps/${app.id}/appStoreVersions?limit=200&fields[appStoreVersions]=versionString,appStoreState,appVersionState,releaseType,platform,createdDate`,
);
console.log(`\nversion records: ${versions.length} total; newest six:`);
for (const v of versions.slice(0, 6)) {
  const a = v.attributes;
  console.log(`  ${a.versionString.padEnd(7)} ${v.id} appStoreState=${a.appStoreState} appVersionState=${a.appVersionState} releaseType=${a.releaseType}`);
}
const open = versions.filter((v) => !['READY_FOR_SALE', 'REPLACED_WITH_NEW_VERSION'].includes(v.attributes.appStoreState));
console.log(`  records not READY_FOR_SALE or replaced: ${open.map((v) => `${v.attributes.versionString}=${v.attributes.appStoreState}`).join(', ') || 'none'}`);

const v = want ? versions.find((x) => x.attributes.versionString === want) : versions[0];
if (!v) throw new Error(`no version record ${want}`);
console.log(`\n== ${v.attributes.versionString} (${v.id}) ${v.attributes.appStoreState}`);

const b = await api('GET', `/v1/appStoreVersions/${v.id}/build?fields[builds]=version,processingState,expired,uploadedDate`);
console.log(`build: ${b.ok && b.json?.data ? `${b.json.data.attributes.version} ${b.json.data.id} ${b.json.data.attributes.processingState} expired=${b.json.data.attributes.expired}` : 'none attached'}`);

const rss = await get(`/v1/reviewSubmissions?filter[app]=${app.id}&limit=5&fields[reviewSubmissions]=state,submittedDate,platform`);
console.log('recent review submissions:');
for (const r of rss.data) console.log(`  ${r.id} state=${r.attributes.state} submitted=${r.attributes.submittedDate}`);

const locs = await get(`/v1/appStoreVersions/${v.id}/appStoreVersionLocalizations?fields[appStoreVersionLocalizations]=locale`);
for (const l of locs.data) console.log(`localization ${l.attributes.locale}: ${l.id}`);
const en = locs.data.find((l) => l.attributes.locale === 'en-US');
if (!en) throw new Error('no en-US localization');

const sets = await getAll(`/v1/appStoreVersionLocalizations/${en.id}/appScreenshotSets?limit=50`);
for (const set of sets) {
  const shots = await getAll(`/v1/appScreenshotSets/${set.id}/appScreenshots?limit=50`);
  console.log(`  set ${set.id} ${set.attributes.screenshotDisplayType} count=${shots.length}`);
  for (const sh of shots) {
    const a = sh.attributes;
    console.log(`    ${a.fileName} ${a.imageAsset?.width}x${a.imageAsset?.height} ${a.fileSize}B md5=${a.sourceFileChecksum} ${a.assetDeliveryState?.state}`);
  }
}

const builds = await get(`/v1/builds?filter[app]=${app.id}&sort=-uploadedDate&limit=4&fields[builds]=version,processingState,expired,uploadedDate,preReleaseVersion&include=preReleaseVersion&fields[preReleaseVersions]=version`);
const train = Object.fromEntries((builds.included ?? []).map((p) => [p.id, p.attributes.version]));
console.log('\nrecent builds:');
for (const bd of builds.data) console.log(`  train ${train[bd.relationships?.preReleaseVersion?.data?.id]} build ${bd.attributes.version} ${bd.id} ${bd.attributes.processingState} expired=${bd.attributes.expired}`);
