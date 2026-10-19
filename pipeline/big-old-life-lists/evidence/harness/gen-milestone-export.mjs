// A synthetic export that reaches every milestone threshold, 10,000 included:
// 10,050 distinct species from the bundled taxonomy, one checklist each, one a
// day from 1890, so the grid shows every badge and the list crosses 1900 and
// 1970. Fictional data. Used for the milestone grid re-measure (decisions.md
// entry 8) and the pre-1970 sweep.
//   node gen-milestone-export.mjs <out dir>
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url))
const out = process.argv[2]
mkdirSync(out, { recursive: true })
const tax = JSON.parse(readFileSync(join(here, '../../../../frontend/src/assets/ebird-taxonomy.json'), 'utf8'))
const species = []
for (const [sciLower, code] of Object.entries(tax.bySci)) {
  const common = tax.byCode[code]
  if (!common || /[/(]| x | sp\.$/.test(common)) continue
  species.push([common, sciLower[0].toUpperCase() + sciLower.slice(1)])
}
const N = 10_050
if (species.length < N) throw new Error(`only ${species.length} species`)
const H = 'Submission ID,Common Name,Scientific Name,Taxonomic Order,Count,State/Province,County,Location ID,Location,Latitude,Longitude,Date,Time,Protocol,Duration (Min),All Obs Reported,Distance Traveled (km),Area Covered (ha),Number of Observers,Breeding Code,Observation Details,Checklist Comments,ML Catalog Numbers'
const esc = (v) => (/[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v)
const rows = [H]
for (let i = 0; i < N; i++) {
  const d = new Date(Date.UTC(1890, 0, 1) + i * 86_400_000).toISOString().slice(0, 10)
  const [c, s] = species[i]
  rows.push([`S${9100000000 + i}`, c, s, String(i + 1), '1', 'US-NY', 'Kings', 'L109516', 'Prospect Park', '40.6602', '-73.9690', d, '07:00 AM', 'Traveling', '60', '1', '1.5', '', '1', '', '', '', ''].map(esc).join(','))
}
writeFileSync(join(out, 'ebird-backup.csv'), rows.join('\n') + '\n')
writeFileSync(join(out, 'metadata.json'), JSON.stringify({ ebird: { filename: 'MyEBirdData.csv', uploadedAt: '2026-10-19T00:00:00Z' }, ml: null }))
console.log(`wrote ${N} rows to ${out}`)
