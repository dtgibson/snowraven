import { readFileSync } from 'node:fs'
import { parseEbirdObservations } from '/Users/developer/devwork/snowraven/frontend/src/lib/parseEbirdObservations'
import { normalizeSpeciesName } from '/Users/developer/devwork/snowraven/frontend/src/lib/speciesUtils'
import {
  buildCoverIndex, classifySpecies, remainingSpecies, carriersNeedingRefetch, greedyCover,
} from '/Users/developer/devwork/snowraven/frontend/src/lib/exoticProvenance'

const DATA = process.argv[2]
const csv = readFileSync(`${DATA}/ebird-backup.csv`, 'utf8')
const tax = JSON.parse(readFileSync(process.env.TAX ?? `${DATA}/taxonomy.json`, "utf8"))
const store = JSON.parse(readFileSync(`${DATA}/settings/exotic-provenance-v1.json`, 'utf8'))
const obs = parseEbirdObservations(csv)

// /taxonomy/codes replica (backend): code = bySci[sci.lower()] || byCom[com.lower()]
const seen = new Map<string, string>()
for (const o of obs) {
  if (!seen.has(o.commonName)) seen.set(o.commonName, o.scientificName)
  const p = normalizeSpeciesName(o.commonName)
  if (p !== o.commonName && !seen.has(p)) seen.set(p, '')
}
const codes: Record<string, string> = {}
for (const [com, sci] of seen) {
  const c = tax.bySci[(sci || '').toLowerCase()] || tax.byCom[com.toLowerCase()]
  if (c) codes[com] = c
}
const normTaxon: Record<string, string> = Object.create(null)
for (const [n, c] of Object.entries(codes)) normTaxon[normalizeSpeciesName(n)] = c
const idx = buildCoverIndex(obs, n => Object.hasOwn(normTaxon, n) ? normTaxon[n] : undefined)

const snapshot = {
  checklists: new Set<string>(store.order),
  species: new Map(store.speciesOrder.map((k: string) => [k, store.species[k]])),
  excludedNames: store.excludedNames, exoticNames: store.exoticNames ?? null,
}
const counts: Record<string, number> = {}
for (const code of idx.nameForCode.keys()) {
  const c = classifySpecies(snapshot as any, idx, code); counts[c] = (counts[c] ?? 0) + 1
}
console.log('rows', obs.length, 'checklists', idx.byChecklist.size, 'species in cover', idx.bySpecies.size, 'unresolvable names', idx.unresolvableNames.size)
console.log('classes', counts)
const remaining = remainingSpecies(snapshot as any, idx, new Set())
console.log('open species', remaining.length)
for (const code of remaining) {
  const rec = snapshot.species.get(code) as any
  const carriers = idx.bySpecies.get(code)!
  const consultedCarriers = carriers.filter(s => snapshot.checklists.has(s)).length
  console.log(' ', code, JSON.stringify(idx.nameForCode.get(code)), classifySpecies(snapshot as any, idx, code), 'carriers', carriers.length, 'consulted', consultedCarriers, 'rec', rec ? JSON.stringify(rec.seen) : '-')
}
const stale = carriersNeedingRefetch(snapshot as any, idx, remaining)
console.log('carriersNeedingRefetch', stale.size)
const now = Date.parse(process.argv[3] ?? '2026-11-06T12:00:00Z')
const TTL = 30*24*3600*1000
const fresh = new Set<string>(store.order.filter((id: string) => now - store.checklists[id] < TTL))
console.log('fresh ledger at', new Date(now).toISOString(), fresh.size, 'of', store.order.length)
for (const id of stale) fresh.delete(id)
const wave0 = greedyCover(idx, remaining, fresh, 500)
console.log('round-0 wave', wave0.length, 'of which in ledger', wave0.filter(s => snapshot.checklists.has(s)).length)
console.log('unresolvable sample', [...idx.unresolvableNames].slice(0, 20))

// ── Simulate runPass (useExoticProvenance.ts) assuming each response yields NO
// record for the three recordless cover codes (the hypothesis), and records the
// ledger entry as mergeChecklist does.
{
  const NEVER = new Set(['willet2', 'eamwre1', 'skylar'])
  const ledger = new Map<string, number>(store.order.map((id: string) => [id, store.checklists[id]]))
  const species = new Map(snapshot.species)
  const snap = () => ({ checklists: new Set(ledger.keys()), species, excludedNames: [], exoticNames: null }) as any
  const attempted = new Set<string>(); const parked = new Set<string>(); const followups = new Map<string, number>()
  let issued = 0; const perSpecies: Record<string, number> = {}
  for (let round = 0; round < 64; round++) {
    const remaining = remainingSpecies(snap(), idx, parked)
    if (remaining.length === 0) break
    const consulted = new Set<string>([...ledger].filter(([, at]) => now - at < TTL).map(([id]) => id))
    const staleL = carriersNeedingRefetch(snap(), idx, remaining)
    for (const id of staleL) consulted.delete(id)
    for (const id of attempted) consulted.add(id)
    const wave = greedyCover(idx, remaining, consulted, 500 - issued)
    if (wave.length === 0) break
    if (round > 0) {
      const open = new Set(remaining)
      for (const sub of wave) for (const code of idx.byChecklist.get(sub) ?? []) {
        if (!open.has(code)) continue
        const n = (followups.get(code) ?? 0) + 1; followups.set(code, n)
        if (n >= 25) parked.add(code)
      }
    }
    for (const sub of wave) {
      attempted.add(sub); issued++
      for (const code of idx.byChecklist.get(sub) ?? []) if (remaining.includes(code)) perSpecies[code] = (perSpecies[code] ?? 0) + 1
      ledger.set(sub, now)
      for (const code of idx.byChecklist.get(sub) ?? []) {
        if (NEVER.has(code)) continue
        if (!species.has(code)) species.set(code, { seen: ['|'], n: 1, at: now } as any)
      }
    }
  }
  console.log('SIM requests this load', issued, perSpecies)
}

// ── Same pass, four loads in a row, TODAY's logic vs a stamp that suppresses the
// heal re-open for a code a successful answer was seen to lack (within the TTL).
for (const withStamp of [false, true]) {
  const NEVER = new Set(['willet2', 'eamwre1', 'skylar'])
  const ledger = new Map<string, number>(store.order.map((id: string) => [id, store.checklists[id]]))
  const species = new Map(snapshot.species)
  const stamps = new Map<string, number>()
  const out: number[] = []
  for (let load = 0; load < 4; load++) {
    const t = now + load * 3600_000
    const snap = () => ({ checklists: new Set(ledger.keys()), species, excludedNames: [], exoticNames: null }) as any
    const attempted = new Set<string>(); const parked = new Set<string>(); const followups = new Map<string, number>()
    let issued = 0
    for (let round = 0; round < 64; round++) {
      const remaining = remainingSpecies(snap(), idx, parked)
      if (remaining.length === 0) break
      const consulted = new Set<string>([...ledger].filter(([, at]) => t - at < TTL).map(([id]) => id))
      const healable = withStamp ? remaining.filter(c => !(stamps.has(c) && t - stamps.get(c)! < TTL)) : remaining
      const staleL = carriersNeedingRefetch(snap(), idx, healable)
      for (const id of staleL) consulted.delete(id)
      for (const id of attempted) consulted.add(id)
      const wave = greedyCover(idx, remaining, consulted, 500 - issued)
      if (wave.length === 0) break
      if (round > 0) {
        const open = new Set(remaining)
        for (const sub of wave) for (const code of idx.byChecklist.get(sub) ?? []) {
          if (!open.has(code)) continue
          const n = (followups.get(code) ?? 0) + 1; followups.set(code, n)
          if (n >= 25) parked.add(code)
        }
      }
      for (const sub of wave) {
        attempted.add(sub); issued++; ledger.set(sub, t)
        for (const code of idx.byChecklist.get(sub) ?? []) {
          if (NEVER.has(code)) { stamps.set(code, t); continue }
          if (!species.has(code)) species.set(code, { seen: ['|'], n: 1, at: t } as any)
        }
      }
    }
    out.push(issued)
  }
  console.log(withStamp ? 'WITH stamp  requests per load' : 'TODAY       requests per load', out)
}
