// A small export across every era an old life list carries: 1850 to 2026, with
// checklists on the boundary days where date code goes wrong (1883-11-18, the
// day US time zones replaced local mean time; 1899-12-31 and 1900-01-01;
// 1969-12-31 and 1970-01-01; the 2000 leap day), species and places reused
// across eras so every tab has history to draw. Fictional data. Used for the
// pre-1970 sweep (decisions.md entry 9).
//   node gen-eras-export.mjs <out dir>
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
const out = process.argv[2]
mkdirSync(out, { recursive: true })
let s = 0x2468ace1
const rnd = () => { s |= 0; s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
const pick = (a) => a[Math.floor(rnd() * a.length)]
const SP = [['American Robin', 'Turdus migratorius'], ['Blue Jay', 'Cyanocitta cristata'], ['Mallard', 'Anas platyrhynchos'], ['Canada Goose', 'Branta canadensis'], ['Black-capped Chickadee', 'Poecile atricapillus'], ['Northern Cardinal', 'Cardinalis cardinalis'], ['Song Sparrow', 'Melospiza melodia'], ['Red-tailed Hawk', 'Buteo jamaicensis'], ['Herring Gull', 'Larus argentatus'], ['Great Blue Heron', 'Ardea herodias'], ['Passenger Pigeon', 'Ectopistes migratorius'], ['Carolina Parakeet', 'Conuropsis carolinensis']]
const LOCS = [['L109516', 'Prospect Park', 40.6602, -73.969, 'Kings', 'US-NY'], ['L191106', 'Central Park', 40.7813, -73.9665, 'New York', 'US-NY'], ['L137800', 'Cape May Point SP', 38.9319, -74.961, 'Cape May', 'US-NJ']]
const H = 'Submission ID,Common Name,Scientific Name,Taxonomic Order,Count,State/Province,County,Location ID,Location,Latitude,Longitude,Date,Time,Protocol,Duration (Min),All Obs Reported,Distance Traveled (km),Area Covered (ha),Number of Observers,Breeding Code,Observation Details,Checklist Comments,ML Catalog Numbers'
const esc = (v) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v)
const dates = ['1850-05-12', '1855-06-01', '1871-04-30', '1883-11-17', '1883-11-18', '1883-11-19', '1899-12-31', '1900-01-01', '1900-02-28', '1900-03-01', '1912-07-04', '1935-10-10', '1969-12-31', '1970-01-01', '1999-12-31', '2000-02-29', '2024-04-09', '2026-01-02']
for (let y = 1850; y <= 2026; y += 7) dates.push(`${y}-0${1 + Math.floor(rnd() * 9)}-1${Math.floor(rnd() * 9)}`)
const rows = [H]
let sub = 9200000000
for (const d of dates.sort()) {
  const [lid, lname, lat, lng, county, st] = pick(LOCS)
  const n = 3 + Math.floor(rnd() * 6)
  const chosen = new Set()
  while (chosen.size < n) chosen.add(pick(SP))
  const id = `S${sub++}`
  const y = Number(d.slice(0, 4))
  const named = y < 1900 && rnd() < 0.5 ? '[name:Old-Timer] banded long ago' : ''
  for (const [c, sci] of chosen) {
    const br = d.slice(5, 7) >= '04' && d.slice(5, 7) <= '07' && rnd() < 0.3 ? 'FL Recently Fledged Young' : ''
    rows.push([id, c, sci, '', String(1 + Math.floor(rnd() * 9)), st, county, lid, lname, String(lat), String(lng), d, y < 1950 ? '' : '07:30 AM', y < 1950 ? 'Historical' : 'Traveling', y < 1950 ? '' : '75', '1', y < 1950 ? '' : '2.1', '', '1', br, c === 'American Robin' ? named : '', '', ''].map(esc).join(','))
  }
}
writeFileSync(join(out, 'ebird-backup.csv'), rows.join('\n') + '\n')
writeFileSync(join(out, 'metadata.json'), JSON.stringify({ ebird: { filename: 'MyEBirdData.csv', uploadedAt: '2026-10-19T00:00:00Z' }, ml: null }))
console.log(`wrote ${rows.length - 1} rows over ${dates.length} checklists to ${out}`)
