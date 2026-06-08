// Generates a synthetic eBird backup + Macaulay Library export for screenshots.
// Fictional birder at well-known PUBLIC northeast-US hotspots. No real personal data.
// Deterministic (seeded) so reruns are stable. Output -> ./demo-data/
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dir = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dir, 'demo-data');
mkdirSync(OUT, { recursive: true });

// ---- seeded PRNG (mulberry32) ----
let _s = 0x9e3779b9;
function rnd() { _s |= 0; _s = (_s + 0x6D2B79F5) | 0; let t = Math.imul(_s ^ (_s >>> 15), 1 | _s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
const pick = (a) => a[Math.floor(rnd() * a.length)];
const rint = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const chance = (p) => rnd() < p;

// ---- public hotspots (real places; coords approximate) ----
const LOCS = [
  { name: 'Central Park', locId: 'L191106', lat: 40.7813, lng: -73.9665, county: 'New York', state: 'US-NY', coastal: false },
  { name: 'Prospect Park', locId: 'L109516', lat: 40.6602, lng: -73.9690, county: 'Kings', state: 'US-NY', coastal: false },
  { name: 'Jamaica Bay Wildlife Refuge', locId: 'L152773', lat: 40.6188, lng: -73.8233, county: 'Queens', state: 'US-NY', coastal: true },
  { name: 'Jones Beach SP--Coast Guard Station', locId: 'L152762', lat: 40.5985, lng: -73.5070, county: 'Nassau', state: 'US-NY', coastal: true },
  { name: 'Montauk Point SP', locId: 'L139721', lat: 41.0717, lng: -71.8567, county: 'Suffolk', state: 'US-NY', coastal: true },
  { name: 'Sterling Forest SP', locId: 'L207471', lat: 41.1976, lng: -74.2549, county: 'Orange', state: 'US-NY', coastal: false },
  { name: 'Doodletown', locId: 'L444485', lat: 41.3079, lng: -73.9912, county: 'Rockland', state: 'US-NY', coastal: false },
  { name: 'Cape May Point SP', locId: 'L137800', lat: 38.9319, lng: -74.9610, county: 'Cape May', state: 'US-NJ', coastal: true },
  { name: 'Sandy Hook', locId: 'L295658', lat: 40.4376, lng: -73.9916, county: 'Monmouth', state: 'US-NJ', coastal: true },
  { name: 'Garret Mountain Reservation', locId: 'L207514', lat: 40.9168, lng: -74.1490, county: 'Passaic', state: 'US-NJ', coastal: false },
];

// ---- species pool: real eBird names so taxonomy/codes resolve. {c: common, s: scientific, t: taxonomic order, ab: abundance 1..5, seas: months active, br: breeding-prone} ----
const ALLM = [1,2,3,4,5,6,7,8,9,10,11,12];
const SP = [
  ['Canada Goose','Branta canadensis',257,5,ALLM,1],
  ['Mute Swan','Cygnus olor',278,2,ALLM,1],
  ['Wood Duck','Aix sponsa',312,3,[3,4,5,6,7,8,9,10],1],
  ['Gadwall','Mareca strepera',330,3,[1,2,3,4,10,11,12],0],
  ['American Wigeon','Mareca americana',340,2,[1,2,3,4,11,12],0],
  ['Mallard','Anas platyrhynchos',360,5,ALLM,1],
  ['American Black Duck','Anas rubripes',365,3,[1,2,3,4,11,12],0],
  ['Northern Shoveler','Spatula clypeata',320,2,[1,2,3,4,11,12],0],
  ['Green-winged Teal','Anas crecca',380,2,[1,2,3,4,10,11,12],0],
  ['Bufflehead','Bucephala albeola',430,3,[1,2,3,11,12],0],
  ['Common Goldeneye','Bucephala clangula',433,2,[1,2,3,12],0],
  ['Hooded Merganser','Lophodytes cucullatus',440,3,[1,2,3,4,11,12],0],
  ['Red-breasted Merganser','Mergus serrator',450,2,[1,2,3,4,11,12],0],
  ['Ruddy Duck','Oxyura jamaicensis',460,2,[1,2,3,4,10,11,12],0],
  ['Wild Turkey','Meleagris gallopavo',230,2,ALLM,1],
  ['Pied-billed Grebe','Podilymbus podiceps',490,2,[1,2,3,4,9,10,11,12],0],
  ['Horned Grebe','Podiceps auritus',500,2,[1,2,3,11,12],0],
  ['Rock Pigeon','Columba livia',1000,5,ALLM,1],
  ['Mourning Dove','Zenaida macroura',1100,5,ALLM,1],
  ['Yellow-billed Cuckoo','Coccyzus americanus',1200,2,[5,6,7,8,9],1],
  ['Common Nighthawk','Chordeiles minor',1300,1,[5,6,8,9],0],
  ['Chimney Swift','Chaetura pelagica',1400,3,[5,6,7,8,9],1],
  ['Ruby-throated Hummingbird','Archilochus colubris',1500,3,[5,6,7,8,9],1],
  ['Clapper Rail','Rallus crepitans',1600,1,[5,6,7,8],1],
  ['Virginia Rail','Rallus limicola',1610,1,[5,6,7,8],0],
  ['American Coot','Fulica americana',1700,3,[1,2,3,4,10,11,12],0],
  ['American Oystercatcher','Haematopus palliatus',1800,2,[4,5,6,7,8,9],1],
  ['Black-bellied Plover','Pluvialis squatarola',1850,2,[4,5,8,9,10],0],
  ['Semipalmated Plover','Charadrius semipalmatus',1870,2,[5,8,9],0],
  ['Killdeer','Charadrius vociferus',1900,3,[3,4,5,6,7,8,9,10],1],
  ['Ruddy Turnstone','Arenaria interpres',1950,2,[5,8,9],0],
  ['Sanderling','Calidris alba',2000,3,[1,4,5,8,9,10,11,12],0],
  ['Semipalmated Sandpiper','Calidris pusilla',2050,3,[5,7,8,9],0],
  ['Least Sandpiper','Calidris minutilla',2070,3,[4,5,7,8,9],0],
  ['Spotted Sandpiper','Actitis macularius',2200,2,[5,6,7,8],1],
  ['Greater Yellowlegs','Tringa melanoleuca',2250,2,[4,5,8,9,10],0],
  ['Lesser Yellowlegs','Tringa flavipes',2270,2,[4,5,8,9],0],
  ['Laughing Gull','Leucophaeus atricilla',2400,3,[4,5,6,7,8,9,10],1],
  ['Ring-billed Gull','Larus delawarensis',2450,5,ALLM,0],
  ['Herring Gull','Larus argentatus',2470,5,ALLM,1],
  ['Great Black-backed Gull','Larus marinus',2490,3,ALLM,1],
  ['Least Tern','Sternula antillarum',2550,2,[5,6,7,8],1],
  ['Common Tern','Sterna hirundo',2570,3,[5,6,7,8,9],1],
  ['Forster’s Tern','Sterna forsteri',2580,2,[5,8,9],0],
  ['Common Loon','Gavia immer',2600,2,[1,2,3,4,11,12],0],
  ['Northern Gannet','Morus bassanus',2650,2,[1,2,3,4,11,12],0],
  ['Double-crested Cormorant','Nannopterum auritum',2700,4,[3,4,5,6,7,8,9,10,11],1],
  ['Great Blue Heron','Ardea herodias',2800,3,ALLM,1],
  ['Great Egret','Ardea alba',2820,3,[4,5,6,7,8,9,10],1],
  ['Snowy Egret','Egretta thula',2830,3,[4,5,6,7,8,9],1],
  ['Green Heron','Butorides virescens',2860,2,[5,6,7,8,9],1],
  ['Black-crowned Night-Heron','Nycticorax nycticorax',2880,2,[4,5,6,7,8,9],1],
  ['Glossy Ibis','Plegadis falcinellus',2900,2,[4,5,6,7,8],1],
  ['Black Vulture','Coragyps atratus',2950,2,ALLM,0],
  ['Turkey Vulture','Cathartes aura',2960,4,[3,4,5,6,7,8,9,10,11],1],
  ['Osprey','Pandion haliaetus',3000,3,[4,5,6,7,8,9],1],
  ['Northern Harrier','Circus hudsonius',3050,2,[1,3,4,9,10,11,12],0],
  ['Cooper’s Hawk','Astur cooperii',3100,3,ALLM,1],
  ['Bald Eagle','Haliaeetus leucocephalus',3150,2,ALLM,1],
  ['Red-shouldered Hawk','Buteo lineatus',3200,2,[1,2,3,4,9,10,11,12],1],
  ['Red-tailed Hawk','Buteo jamaicensis',3250,4,ALLM,1],
  ['Eastern Screech-Owl','Megascops asio',3300,1,ALLM,1],
  ['Great Horned Owl','Bubo virginianus',3320,1,ALLM,1],
  ['Barred Owl','Strix varia',3340,1,ALLM,1],
  ['Belted Kingfisher','Megaceryle alcyon',3400,2,ALLM,1],
  ['Red-bellied Woodpecker','Melanerpes carolinus',3500,4,ALLM,1],
  ['Downy Woodpecker','Dryobates pubescens',3550,4,ALLM,1],
  ['Hairy Woodpecker','Dryobates villosus',3570,2,ALLM,1],
  ['Northern Flicker','Colaptes auratus',3600,3,ALLM,1],
  ['Pileated Woodpecker','Dryocopus pileatus',3620,1,ALLM,1],
  ['American Kestrel','Falco sparverius',3700,2,[1,3,4,8,9,10,11],1],
  ['Merlin','Falco columbarius',3720,1,[1,4,9,10,11,12],0],
  ['Peregrine Falcon','Falco peregrinus',3750,1,ALLM,1],
  ['Eastern Wood-Pewee','Contopus virens',3800,2,[5,6,7,8,9],1],
  ['Eastern Phoebe','Sayornis phoebe',3850,3,[3,4,5,6,7,8,9,10],1],
  ['Great Crested Flycatcher','Myiarchus crinitus',3870,2,[5,6,7,8],1],
  ['Eastern Kingbird','Tyrannus tyrannus',3900,2,[5,6,7,8],1],
  ['White-eyed Vireo','Vireo griseus',3950,2,[5,6,7,8,9],1],
  ['Warbling Vireo','Vireo gilvus',3970,2,[5,6,7,8],1],
  ['Red-eyed Vireo','Vireo olivaceus',3990,3,[5,6,7,8,9],1],
  ['Blue Jay','Cyanocitta cristata',4000,5,ALLM,1],
  ['American Crow','Corvus brachyrhynchos',4050,5,ALLM,1],
  ['Fish Crow','Corvus ossifragus',4060,3,ALLM,1],
  ['Common Raven','Corvus corax',4070,1,ALLM,1],
  ['Tree Swallow','Tachycineta bicolor',4100,4,[3,4,5,6,7,8,9],1],
  ['Northern Rough-winged Swallow','Stelgidopteryx serripennis',4120,2,[4,5,6,7,8],1],
  ['Barn Swallow','Hirundo rustica',4150,3,[4,5,6,7,8,9],1],
  ['Black-capped Chickadee','Poecile atricapillus',4200,4,ALLM,1],
  ['Tufted Titmouse','Baeolophus bicolor',4250,4,ALLM,1],
  ['White-breasted Nuthatch','Sitta carolinensis',4300,4,ALLM,1],
  ['Red-breasted Nuthatch','Sitta canadensis',4320,2,[1,2,3,4,9,10,11,12],0],
  ['Brown Creeper','Certhia americana',4350,2,[1,2,3,4,10,11,12],0],
  ['House Wren','Troglodytes aedon',4400,3,[5,6,7,8,9],1],
  ['Carolina Wren','Thryothorus ludovicianus',4450,4,ALLM,1],
  ['Marsh Wren','Cistothorus palustris',4470,1,[5,6,7,8,9],1],
  ['Blue-gray Gnatcatcher','Polioptila caerulea',4500,2,[4,5,6,7,8],1],
  ['Ruby-crowned Kinglet','Corthylio calendula',4520,3,[1,3,4,10,11,12],0],
  ['Golden-crowned Kinglet','Regulus satrapa',4540,2,[1,3,4,10,11,12],0],
  ['Eastern Bluebird','Sialia sialis',4600,3,ALLM,1],
  ['Veery','Catharus fuscescens',4620,2,[5,6,7,8,9],1],
  ['Swainson’s Thrush','Catharus ustulatus',4640,2,[5,9],0],
  ['Hermit Thrush','Catharus guttatus',4660,3,[1,3,4,10,11,12],0],
  ['Wood Thrush','Hylocichla mustelina',4680,2,[5,6,7,8],1],
  ['American Robin','Turdus migratorius',4700,5,ALLM,1],
  ['Gray Catbird','Dumetella carolinensis',4750,4,[4,5,6,7,8,9,10],1],
  ['Brown Thrasher','Toxostoma rufum',4770,2,[4,5,6,7,8,9],1],
  ['Northern Mockingbird','Mimus polyglottos',4790,4,ALLM,1],
  ['European Starling','Sturnus vulgaris',4800,5,ALLM,1],
  ['Cedar Waxwing','Bombycilla cedrorum',4850,3,ALLM,1],
  ['House Sparrow','Passer domesticus',4900,5,ALLM,1],
  ['House Finch','Haemorhous mexicanus',4950,4,ALLM,1],
  ['Purple Finch','Haemorhous purpureus',4960,1,[1,3,4,10,11,12],0],
  ['American Goldfinch','Spinus tristis',5000,4,ALLM,1],
  ['Chipping Sparrow','Spizella passerina',5100,3,[4,5,6,7,8,9,10],1],
  ['Field Sparrow','Spizella pusilla',5120,2,[4,5,6,7,8,9],1],
  ['Fox Sparrow','Passerella iliaca',5140,2,[1,3,4,11,12],0],
  ['Dark-eyed Junco','Junco hyemalis',5160,4,[1,2,3,4,10,11,12],0],
  ['White-throated Sparrow','Zonotrichia albicollis',5180,4,[1,2,3,4,10,11,12],0],
  ['White-crowned Sparrow','Zonotrichia leucophrys',5190,2,[4,5,10,11],0],
  ['Savannah Sparrow','Passerculus sandwichensis',5210,2,[4,5,9,10,11],0],
  ['Song Sparrow','Melospiza melodia',5230,5,ALLM,1],
  ['Swamp Sparrow','Melospiza georgiana',5250,2,[1,3,4,9,10,11,12],1],
  ['Eastern Towhee','Pipilo erythrophthalmus',5300,3,[4,5,6,7,8,9],1],
  ['Bobolink','Dolichonyx oryzivorus',5400,1,[5,6,8,9],0],
  ['Eastern Meadowlark','Sturnella magna',5420,1,[3,4,5,6,9,10],1],
  ['Baltimore Oriole','Icterus galbula',5500,3,[5,6,7,8],1],
  ['Orchard Oriole','Icterus spurius',5510,2,[5,6,7],1],
  ['Red-winged Blackbird','Agelaius phoeniceus',5550,5,[2,3,4,5,6,7,8,9,10,11],1],
  ['Brown-headed Cowbird','Molothrus ater',5570,3,[3,4,5,6,7,8,9],1],
  ['Common Grackle','Quiscalus quiscula',5600,5,[2,3,4,5,6,7,8,9,10,11],1],
  ['Boat-tailed Grackle','Quiscalus major',5620,2,[3,4,5,6,7,8,9],1],
  ['Ovenbird','Seiurus aurocapilla',5700,3,[5,6,7,8,9],1],
  ['Northern Waterthrush','Parkesia noveboracensis',5710,2,[5,8,9],0],
  ['Black-and-white Warbler','Mniotilta varia',5730,3,[5,8,9],1],
  ['Common Yellowthroat','Geothlypis trichas',5760,3,[5,6,7,8,9],1],
  ['American Redstart','Setophaga ruticilla',5800,3,[5,6,8,9],1],
  ['Northern Parula','Setophaga americana',5820,3,[5,8,9],0],
  ['Magnolia Warbler','Setophaga magnolia',5840,2,[5,9],0],
  ['Yellow Warbler','Setophaga petechia',5860,3,[5,6,7,8],1],
  ['Blackpoll Warbler','Setophaga striata',5880,2,[5,9,10],0],
  ['Black-throated Blue Warbler','Setophaga caerulescens',5900,2,[5,9],0],
  ['Palm Warbler','Setophaga palmarum',5920,3,[4,5,9,10],0],
  ['Pine Warbler','Setophaga pinus',5940,2,[3,4,5,8,9,10],1],
  ['Yellow-rumped Warbler','Setophaga coronata',5960,4,[1,4,5,9,10,11,12],0],
  ['Black-throated Green Warbler','Setophaga virens',5980,2,[5,9],0],
  ['Scarlet Tanager','Piranga olivacea',6100,2,[5,6,7,8],1],
  ['Northern Cardinal','Cardinalis cardinalis',6150,5,ALLM,1],
  ['Rose-breasted Grosbeak','Pheucticus ludovicianus',6170,2,[5,6,8,9],1],
  ['Indigo Bunting','Passerina cyanea',6200,2,[5,6,7,8],1],
];

// ---- ML media: subset of species get photo/audio/video coverage ----
const FORMATS = ['Photo','Photo','Photo','Photo','Audio','Video'];

// ---- generate checklists ----
const startY = 2024, startM = 0; // Jan 2024
const endDate = new Date(2026, 5, 1); // ~Jun 2026
let subSeq = 184500000; // S<seq>
const seenFirst = new Set();
const ebirdRows = [];
const mlRows = [];
let mlSeq = 612000000;

function fmtTime(h, m) { const ap = h < 12 ? 'AM' : 'PM'; let hh = h % 12; if (hh === 0) hh = 12; return `${String(hh).padStart(2,'0')}:${String(m).padStart(2,'0')} ${ap}`; }
function csvEsc(v) { v = String(v ?? ''); return /[",\n]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v; }

const COMMENTS = [
  'Foraging low in the willows near the water.','Singing from the canopy.','Pair working a nest cavity.',
  'Carrying nest material.','Mixed flock with chickadees and titmice.','Heard only, never came into view.',
  'Great looks in good light.','Feeding young just out of the nest.','Flyover heading south.',
  'Same individual as last week, still holding territory.','First of year here.','High count for this spot.',
];
const CHK_COMMENTS = [
  'Cool, clear morning after the front came through.','Steady warbler movement all morning.',
  'Quiet midday walk, mostly residents.','Big push of migrants overnight.','Light rain held off until the end.',
  'Incoming tide concentrated the shorebirds.','Family outing, easy pace.',
];

// month -> rough abundance bias by season handled via species.seas membership.
let d = new Date(startY, startM, 3, 7, 0);
while (d < endDate) {
  // 1-3 checklists this iteration step (~ every 4 days)
  const nChk = chance(0.5) ? 1 : (chance(0.6) ? 2 : 3);
  for (let c = 0; c < nChk; c++) {
    const loc = pick(LOCS);
    const month = d.getMonth() + 1;
    const traveling = chance(0.7);
    const protocol = traveling ? 'Traveling' : (chance(0.85) ? 'Stationary' : 'Incidental');
    const dur = traveling ? rint(45, 150) : rint(20, 75);
    const dist = traveling ? (Math.round((dur / 60) * (rnd() * 2 + 1) * 100) / 100) : '';
    const nobs = chance(0.6) ? 1 : rint(2, 4);
    const allObs = chance(0.9) ? 1 : 0;
    const subId = 'S' + (subSeq++);
    const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const sh = rint(6, 16), sm = pick([0,5,10,15,20,30,40,45,50]);
    const timeStr = fmtTime(sh, sm);
    const chkComment = chance(0.35) ? pick(CHK_COMMENTS) : '';

    // candidate species in season for this location type
    let pool = SP.filter(sp => sp[4].includes(month) && (loc.coastal || (sp[1] !== 'shorebird')));
    // coastal species more likely at coastal locs; reduce waterbirds inland
    pool = pool.filter(sp => loc.coastal ? true : ![2400,2550,2570,2580,2600,2650,1800,1850,1870,1950,2000,2050,2070,2250,2270,5620].includes(sp[2]));
    // species count on this checklist, weighted by abundance
    const target = rint(8, Math.min(34, pool.length));
    const chosen = new Set();
    let guard = 0;
    while (chosen.size < target && guard < target * 6) {
      guard++;
      const sp = pick(pool);
      // weight by abundance
      if (rnd() < sp[3] / 5) chosen.add(sp);
    }
    for (const sp of chosen) {
      const [common, sci, tax, ab, seas, brPron] = sp;
      const presenceOnly = chance(0.06);
      const count = presenceOnly ? 'X' : String(Math.max(1, Math.round((rnd() ** 2) * (ab * 6))));
      let breeding = '';
      const breedingSeason = month >= 4 && month <= 7;
      if (brPron && breedingSeason && chance(0.16)) {
        breeding = pick(['S','S7','P','T','C','N','CF','FL','ON','NB','NY','FY','CN']);
      }
      const spComment = chance(0.07) ? pick(COMMENTS) : '';
      // media: ~ for some species/observations
      let mlIds = '';
      if (chance(0.05)) {
        const nMedia = chance(0.8) ? 1 : 2;
        const ids = [];
        for (let k = 0; k < nMedia; k++) {
          const id = (mlSeq++);
          ids.push(id);
          const fmt = pick(FORMATS);
          mlRows.push({ id, fmt, common, sci, date: dateStr, loc, tax });
        }
        mlIds = ids.join(' ');
      }
      ebirdRows.push([
        subId, common, sci, tax, count, loc.state, loc.county, loc.locId, loc.name,
        loc.lat.toFixed(4), loc.lng.toFixed(4), dateStr, timeStr, protocol, dur, allObs,
        dist, '', nobs, breeding, spComment, chkComment, mlIds,
      ]);
      seenFirst.add(common);
    }
  }
  d = new Date(d.getTime() + rint(2, 6) * 86400000);
}

// ---- write eBird backup ----
const EB_HEADER = ['Submission ID','Common Name','Scientific Name','Taxonomic Order','Count','State/Province','County','Location ID','Location','Latitude','Longitude','Date','Time','Protocol','Duration (Min)','All Obs Reported','Distance Traveled (km)','Area Covered (ha)','Number of Observers','Breeding Code','Observation Details','Checklist Comments','ML Catalog Numbers'];
const ebCsv = [EB_HEADER.join(',')].concat(ebirdRows.map(r => r.map(csvEsc).join(','))).join('\n') + '\n';
writeFileSync(join(OUT, 'ebird-backup.csv'), ebCsv);

// ---- write ML export ----
const ML_HEADER = ['ML Catalog Number','Format','Common Name','Scientific Name','Background Species','Caption','Recordist','Date','Year','Month','Day','Time','Country','Country-State-County','State','County','Locality','Latitude','Longitude','Age/Sex','Behaviors','Playback','Captive','Collected','Specimen ID','Home Archive Catalog Number','Recorder','Microphone','Accessory','Partner Institution','eBird Checklist ID','Unconfirmed','Air Temp(°C)','Water Temp(°C)','Media notes','Observation Details','Parent Species','eBird Species Code','Taxon Category','Taxonomic Sort','Recordist 2','Average Community Rating','Number of Ratings','Asset Tags','Original Image Height','Original Image Width'];
const mlOut = mlRows.map(m => {
  const [y, mo, da] = m.date.split('-');
  const row = new Array(ML_HEADER.length).fill('');
  row[0] = m.id; row[1] = m.fmt; row[2] = m.common; row[3] = m.sci;
  row[6] = 'Robin Hartley'; row[7] = m.date; row[8] = y; row[9] = String(+mo); row[10] = String(+da);
  row[12] = 'United States'; row[13] = `United States/${m.loc.state.replace('US-','')}/${m.loc.county}`;
  row[14] = m.loc.state.replace('US-',''); row[15] = m.loc.county; row[16] = m.loc.name;
  row[17] = m.loc.lat.toFixed(4); row[18] = m.loc.lng.toFixed(4);
  row[39] = String(m.tax); row[42] = String(rint(2,40));
  return row.map(csvEsc).join(',');
});
const mlCsv = [ML_HEADER.join(',')].concat(mlOut).join('\n') + '\n';
writeFileSync(join(OUT, 'ml-export.csv'), mlCsv);

// ---- metadata + map defaults ----
writeFileSync(join(OUT, 'metadata.json'), JSON.stringify({
  ebird: { filename: 'MyEBirdData.csv', uploadedAt: '2026-06-01T12:00:00Z' },
  ml: { filename: 'ML__2026-06-01T00-00_USER4741544.csv', uploadedAt: '2026-06-01T12:00:00Z' },
}, null, 0));
writeFileSync(join(OUT, 'map-defaults.json'), JSON.stringify({ lat: 40.73, lng: -73.95, dist: 5 }));

const species = new Set(ebirdRows.map(r => r[1]));
console.log(`eBird rows: ${ebirdRows.length}, species: ${species.size}, checklists: ${new Set(ebirdRows.map(r=>r[0])).size}, ML rows: ${mlRows.length}`);
