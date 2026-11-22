// The pure core of the family asset, `frontend/src/assets/ebird-families.json`
// (family-rollups-and-tree, schema.md sections 2 and 3). No `process`, no `fs`,
// no network, no app imports: `scripts/build-ebird-taxonomy.mjs` derives the
// asset from the SAME single eBird response it already fetches (it writes it in
// both of its write modes, under the unchanged revision check), and
// `frontend/src/lib/familiesGenerator.test.ts` drives this module over small
// in-memory fixtures. `checkFamilies` is the SAME checker the CI guard
// (`frontend/src/lib/familiesAsset.test.ts`) runs over the committed asset, so
// the generator refuses to write anything CI would refuse.
//
// WHAT THE ASSET HOLDS (schema 2.2). For every order, family, genus and species
// the response classifies, in eBird's taxonomic sequence, so a taxon's position
// IS its index and contiguity is structural:
//
//   { v: 2, version, orders: [order, ...], extinct: [lowercaseCommonName, ...] }
//   order  = [orderName, orderCommonName, [family, ...]]
//   family = [familyCode, familyComName, familySciName, living, [genus, ...]]
//   genus  = [genusName, [lcName, epithet, lcName, epithet, ...]]
//         or [genusName, [...], genusCommonName]   where the rule of 3.5 names it
//
// It is keyed by lowercase common name and is self-sufficient: the app loads it
// alone and never the 1.8 MB snapshot (schema 2.2, D-04). It carries no
// `generated` date, so the same taxonomy derives the same bytes.
//
// THE NAMES (schema 3.5, FR-82, FR-83). An order's common name comes from ONE
// authored table, `ORDER_COMMON_NAMES`, the wording the user approved at the
// design review (design-spec 6.2). A genus's common name comes from ONE pure
// rule, `genusCommonName`, over its species' common names as eBird spells them,
// with two closed lists: `GENUS_PLURAL_EXCEPTIONS` and `GENUS_LEFT_UNNAMED`. No
// naming code exists at run time; the app only reads the asset.
//
// FAIL CLOSED. Every check returns violation messages; one message stops the
// whole run with nothing written (FR-03).

import { gzipSync } from 'node:zlib'

/** Asset schema version. Version 1 never shipped. */
export const FAMILIES_ASSET_VERSION = 2

/** The size bound, 200 KiB gzipped: the alpha-code asset's budget. */
export const FAMILIES_GZIP_MAX_BYTES = 204_800

/**
 * The family-code shape. Spelled here because this module takes no app
 * imports; `familiesGenerator.test.ts` holds it equal to the runtime
 * `FAMILY_CODE_RE` in `frontend/src/lib/familyTreeLinks.ts` (the two
 * declarations compared, never restated). Its class cannot express a scheme,
 * a host, a credential, a path separator or a percent escape.
 */
export const FAMILY_CODE_SHAPE_RE = /^[a-z]{2,12}[0-9]{1,3}$/

// Name bounds, in UTF-16 code units (schema 3.1). eBird's longest, measured on
// the 2026 taxonomy: family common 44, family scientific 18, order 19, genus 18,
// epithet 21, species common 35; the longest authored order name is 23 and the
// longest derived genus name 21.
export const FAMILY_COM_MAX = 80
export const FAMILY_SCI_MAX = 40
export const ORDER_MAX = 40
export const GENUS_MAX = 40
export const EPITHET_MAX = 40
export const SPECIES_NAME_MAX = 128
export const ORDER_COMMON_MAX = 40
export const GENUS_COMMON_MAX = 40

// Plausibility floors (F8), well below eBird's 2026 figures (250 families, 45
// orders, 2,379 genera), so a truncated fetch stops the run.
export const MIN_FAMILIES = 200
export const MIN_ORDERS = 30
export const MIN_GENERA = 1_500
/** The three floors as one value, so a fixture suite can lower them in one place. */
export const FAMILY_FLOORS = Object.freeze({ families: MIN_FAMILIES, orders: MIN_ORDERS, genera: MIN_GENERA })

/**
 * FR-82: the order common names, one row per order of the response, in the
 * wording the user approved at the design review (D-21, D-23; design-spec
 * section 6.2, which `familiesAsset.test.ts` holds this table to name for
 * name). A new order stops the generator (G6) until its row is authored here,
 * and the wording of a new row is the user's to approve.
 */
export const ORDER_COMMON_NAMES = Object.freeze({
  Struthioniformes: 'Ostriches',
  Casuariiformes: 'Cassowaries and Emu',
  Apterygiformes: 'Kiwis',
  Rheiformes: 'Rheas',
  Tinamiformes: 'Tinamous',
  Anseriformes: 'Waterfowl',
  Galliformes: 'Gamebirds',
  Columbiformes: 'Pigeons and Doves',
  Mesitornithiformes: 'Mesites',
  Pterocliformes: 'Sandgrouse',
  Otidiformes: 'Bustards',
  Musophagiformes: 'Turacos',
  Cuculiformes: 'Cuckoos',
  Caprimulgiformes: 'Nightjars',
  Nyctibiiformes: 'Potoos',
  Steatornithiformes: 'Oilbird',
  Podargiformes: 'Frogmouths',
  Aegotheliformes: 'Owlet-nightjars',
  Apodiformes: 'Swifts and Hummingbirds',
  Gruiformes: 'Rails and Cranes',
  Charadriiformes: 'Shorebirds and Gulls',
  Phoenicopteriformes: 'Flamingos',
  Podicipediformes: 'Grebes',
  Opisthocomiformes: 'Hoatzin',
  Eurypygiformes: 'Kagu and Sunbittern',
  Phaethontiformes: 'Tropicbirds',
  Gaviiformes: 'Loons',
  Sphenisciformes: 'Penguins',
  Procellariiformes: 'Tubenoses',
  Ciconiiformes: 'Storks',
  Suliformes: 'Cormorants and Allies',
  Pelecaniformes: 'Pelicans and Herons',
  Cathartiformes: 'New World Vultures',
  Accipitriformes: 'Hawks and Eagles',
  Strigiformes: 'Owls',
  Coliiformes: 'Mousebirds',
  Leptosomiformes: 'Cuckoo-roller',
  Trogoniformes: 'Trogons',
  Bucerotiformes: 'Hornbills and Hoopoes',
  Coraciiformes: 'Kingfishers and Allies',
  Piciformes: 'Woodpeckers and Allies',
  Cariamiformes: 'Seriemas',
  Falconiformes: 'Falcons and Caracaras',
  Psittaciformes: 'Parrots',
  Passeriformes: 'Perching Birds',
})

/**
 * FR-83's closed list of plural exceptions, consulted before the regular
 * endings. `suffix` is matched, ignoring case, against the end of the group
 * word (so "Sage-Grouse" and "Junglefowl" are reached); `plural` replaces that
 * suffix, keeping the word's own capitals before it. `firstWord` marks the two
 * compound names that pluralize on their first word.
 */
export const GENUS_PLURAL_EXCEPTIONS = Object.freeze([
  Object.freeze({ suffix: 'fowl', plural: 'fowl' }),
  Object.freeze({ suffix: 'grouse', plural: 'grouse' }),
  Object.freeze({ suffix: 'quail', plural: 'quail' }),
  Object.freeze({ suffix: 'goose', plural: 'geese' }),
  Object.freeze({ suffix: 'titmouse', plural: 'titmice' }),
  Object.freeze({ suffix: 'monarch', plural: 'monarchs' }),
  Object.freeze({ suffix: 'bird-of-paradise', plural: 'birds-of-paradise', firstWord: true }),
  Object.freeze({ suffix: 'cock-of-the-rock', plural: 'cocks-of-the-rock', firstWord: true }),
])

/**
 * FR-83's second closed list: genera the rule would name but that stay
 * scientific only, each settled at the FR-91 read-through and recorded in the
 * run's `decisions.md`. G7 stops the run when a member names no genus the rule
 * would otherwise name, so the list cannot outlive its reason.
 *
 *   Moho  the rule gives "Oos" (Kauai Oo, Oahu Oo, Bishop's Oo, Hawaii Oo),
 *         which reads as a misprint; the genus shows as Moho
 *         (family-rollups-and-tree decisions.md D-40, the read-through of
 *         2026-11-21).
 */
export const GENUS_LEFT_UNNAMED = Object.freeze(['Moho'])

// -- Small hand-written helpers (no regex over eBird's text but the two below) -

const WHITESPACE_RE = /\s+/
/** C0 and C1 control characters, the line and paragraph separators, written as escapes. */
const CONTROL_RE = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/

/** A non-empty string within `max` code units with no control character. */
function okName(v, max) {
  return typeof v === 'string' && v.length > 0 && v.length <= max && !CONTROL_RE.test(v)
}

function lastWord(name) {
  const words = String(name).trim().split(WHITESPACE_RE)
  return words[words.length - 1] ?? ''
}

function afterLastHyphen(word) {
  const i = word.lastIndexOf('-')
  return i === -1 ? word : word.slice(i + 1)
}

function allEqualIgnoringCase(words) {
  if (words.length === 0) return false
  const first = words[0].toLowerCase()
  if (first === '') return false
  for (let i = 1; i < words.length; i++) if (words[i].toLowerCase() !== first) return false
  return true
}

const VOWELS = new Set(['a', 'e', 'i', 'o', 'u'])

/** The plural of a group word: the closed exception list first, then the regular endings. */
export function pluralOfGroupWord(word) {
  const lc = word.toLowerCase()
  for (const ex of GENUS_PLURAL_EXCEPTIONS) {
    if (!lc.endsWith(ex.suffix)) continue
    const keep = word.slice(0, word.length - ex.suffix.length)
    const tail = word.slice(word.length - ex.suffix.length)
    // Keep the word's own capitals letter for letter where the plural shares
    // them, so "Bird-of-Paradise" becomes "Birds-of-Paradise", "Goose" "Geese".
    let plural = ''
    if (ex.firstWord) {
      const h = tail.indexOf('-')
      plural = tail.slice(0, h) + 's' + tail.slice(h)
    } else {
      for (let i = 0; i < ex.plural.length; i++) {
        const c = ex.plural[i]
        const t = i < tail.length ? tail[i] : ''
        plural += t !== '' && t === t.toUpperCase() && t !== t.toLowerCase() ? c.toUpperCase() : c
      }
    }
    return keep + plural
  }
  const last = lc[lc.length - 1] ?? ''
  const two = lc.slice(-2)
  if (last === 's' || last === 'x' || last === 'z' || two === 'ch' || two === 'sh') return word + 'es'
  if (last === 'y' && lc.length >= 2 && !VOWELS.has(lc[lc.length - 2])) return word.slice(0, -1) + 'ies'
  return word + 's'
}

/**
 * FR-83, schema 3.5: the genus's common name, or '' for none. `speciesCommonNames`
 * are the genus's species-category names as eBird spells them, extinct ones
 * included. Steps, in order:
 *   1. fewer than two species: none;
 *   2. the group word is each name's whole last word (a hyphenated word whole);
 *      only if those disagree ignoring case, the part after each last word's
 *      last hyphen; if those disagree too, none;
 *   3. a group word equal to the genus name ignoring case (Vireo, Junco): none;
 *   4. the plural, by GENUS_PLURAL_EXCEPTIONS and then the regular endings;
 *   5. the first letter capitalized, the rest as eBird wrote it;
 *   6. a genus in GENUS_LEFT_UNNAMED: none.
 * The spelling used is the first species', the response's own order.
 */
export function genusCommonName(genus, speciesCommonNames, leftUnnamed = GENUS_LEFT_UNNAMED) {
  if (!Array.isArray(speciesCommonNames) || speciesCommonNames.length < 2) return ''
  let words = speciesCommonNames.map(lastWord)
  if (!allEqualIgnoringCase(words)) {
    words = words.map(afterLastHyphen)
    if (!allEqualIgnoringCase(words)) return ''
  }
  const word = words[0]
  if (word.toLowerCase() === String(genus).toLowerCase()) return ''
  if (leftUnnamed.includes(genus)) return ''
  const plural = pluralOfGroupWord(word)
  return plural.charAt(0).toUpperCase() + plural.slice(1)
}

// -- The live-response checks (G1 to G7) -------------------------------------

const isSpecies = (t) => t !== null && typeof t === 'object' && t.category === 'species'
const nonEmpty = (v) => typeof v === 'string' && v.length > 0

/** The genus name of a species row: the first word of its scientific name. */
function genusOf(sciName) {
  return String(sciName).trim().split(WHITESPACE_RE)[0] ?? ''
}

/**
 * G1 to G7 (schema 3.2): the checks that need the response itself. Returns
 * every violation found (empty when the response is sound).
 */
export function liveFamilyViolations(taxonomy, { orderNames = ORDER_COMMON_NAMES, leftUnnamed = GENUS_LEFT_UNNAMED } = {}) {
  const out = []
  if (!Array.isArray(taxonomy)) return ['the response is not an array']
  const triples = new Map()
  const orders = new Set()
  const generaNames = new Map()
  for (const t of taxonomy) {
    if (!isSpecies(t)) continue
    const who = `${String(t.speciesCode)} (${String(t.comName)})`
    // G1
    if (!nonEmpty(t.order) || !nonEmpty(t.familyCode) || !nonEmpty(t.familyComName) || !nonEmpty(t.familySciName)) {
      out.push(`G1: species ${who} lacks an order or a family field`)
      continue
    }
    // G3
    if (Object.hasOwn(t, 'extinct') && t.extinct !== true && t.extinct !== false) {
      out.push(`G3: species ${who} carries extinct = ${JSON.stringify(t.extinct)}, neither true nor false`)
    }
    // G4
    const words = String(t.sciName ?? '').trim().split(WHITESPACE_RE)
    if (typeof t.sciName !== 'string' || words.length !== 2 || words[0] === '' || words[1] === '') {
      out.push(`G4: species ${who} has scientific name ${JSON.stringify(t.sciName)}, not exactly two words`)
    }
    // G2
    const triple = `${t.familyComName}\u0000${t.familySciName}\u0000${t.order}`
    const seen = triples.get(t.familyCode)
    if (seen === undefined) triples.set(t.familyCode, triple)
    else if (seen !== triple) out.push(`G2: family ${t.familyCode} maps to more than one (common name, scientific name, order)`)
    orders.add(t.order)
    const g = genusOf(t.sciName)
    if (!generaNames.has(g)) generaNames.set(g, [])
    generaNames.get(g).push(t.comName)
  }
  // G6, both directions, read through Object.hasOwn.
  for (const o of orders) if (!Object.hasOwn(orderNames, o)) out.push(`G6: order ${o} has no authored common name in ORDER_COMMON_NAMES; author it (the user approves the wording) and re-run`)
  for (const o of Object.keys(orderNames)) if (!orders.has(o)) out.push(`G6: ORDER_COMMON_NAMES names ${o}, which is not an order of the response; remove its row`)
  // G7: every left-unnamed genus is a genus the rule would otherwise name.
  for (const g of leftUnnamed) {
    const names = generaNames.get(g)
    if (names === undefined || genusCommonName(g, names, []) === '') out.push(`G7: GENUS_LEFT_UNNAMED holds ${g}, which the rule would not name; remove it`)
  }
  return out
}

// -- The derivation -----------------------------------------------------------

/**
 * The asset object. One pass in response order over species-category rows
 * (eBird's response is in taxonomic sequence); every accumulator is a `Map`, so
 * a hostile name can never write a prototype. A family or genus that recurs
 * after another is merged here and then refused by F3, whose strictly
 * increasing sequence it breaks. Call `liveFamilyViolations` first.
 */
export function deriveFamilies(taxonomy, { version, orderNames = ORDER_COMMON_NAMES, leftUnnamed = GENUS_LEFT_UNNAMED }) {
  const orders = new Map()
  const extinct = []
  for (const t of taxonomy) {
    if (!isSpecies(t)) continue
    let order = orders.get(t.order)
    if (order === undefined) {
      order = { name: t.order, families: new Map() }
      orders.set(t.order, order)
    }
    let family = order.families.get(t.familyCode)
    if (family === undefined) {
      family = { code: t.familyCode, com: t.familyComName, sci: t.familySciName, living: 0, genera: new Map() }
      order.families.set(t.familyCode, family)
    }
    const [genusName, epithet] = String(t.sciName).trim().split(WHITESPACE_RE)
    let genus = family.genera.get(genusName)
    if (genus === undefined) {
      genus = { name: genusName, species: [], names: [] }
      family.genera.set(genusName, genus)
    }
    const lc = String(t.comName).toLowerCase()
    genus.species.push(lc, epithet ?? '')
    genus.names.push(t.comName)
    if (t.extinct === true) extinct.push(lc)
    else family.living += 1
  }
  const out = []
  for (const order of orders.values()) {
    const fams = []
    for (const f of order.families.values()) {
      const gens = []
      for (const g of f.genera.values()) {
        const common = genusCommonName(g.name, g.names, leftUnnamed)
        gens.push(common === '' ? [g.name, g.species] : [g.name, g.species, common])
      }
      fams.push([f.code, f.com, f.sci, f.living, gens])
    }
    const common = Object.hasOwn(orderNames, order.name) ? orderNames[order.name] : ''
    out.push([order.name, common, fams])
  }
  return { v: FAMILIES_ASSET_VERSION, version, orders: out, extinct }
}

// -- The shared checker (F1 to F11) ------------------------------------------

const isArr = Array.isArray

/**
 * The shared invariant checker, run by the generator over what it would write
 * and by CI over the committed asset. `snapshot` is the taxonomy snapshot the
 * same run writes (its `version`, `byCom`, `bySci`, `byOrder` and `byCode`).
 * Returns every violation found (empty when the asset is sound). Never throws
 * on a malformed asset: a wrong shape is a violation.
 */
export function checkFamilies(asset, snapshot, { orderNames = ORDER_COMMON_NAMES, leftUnnamed = GENUS_LEFT_UNNAMED, floors = FAMILY_FLOORS, json } = {}) {
  const out = []
  if (typeof asset !== 'object' || asset === null || isArr(asset)) return ['the asset is not an object']
  // F1
  if (asset.v !== FAMILIES_ASSET_VERSION) out.push(`F1: v is ${String(asset.v)}, expected ${FAMILIES_ASSET_VERSION}`)
  if (asset.version !== snapshot.version) out.push(`F1: version "${String(asset.version)}" does not equal the snapshot version "${String(snapshot.version)}"`)
  if (!isArr(asset.orders) || !isArr(asset.extinct)) return [...out, 'orders or extinct is not an array']

  const flat = []
  const familyCodes = new Set()
  const orderSeen = new Set()
  const genusSeen = new Set()
  let families = 0
  let genera = 0
  const extinctSet = new Set()
  for (const e of asset.extinct) {
    if (typeof e !== 'string') { out.push('F6: an extinct member is not a string'); continue }
    if (extinctSet.has(e)) out.push(`F6: "${e}" is listed extinct twice`)
    extinctSet.add(e)
  }
  const speciesSeen = new Set()

  for (const order of asset.orders) {
    if (!isArr(order) || order.length !== 3 || !isArr(order[2])) { out.push('an order tuple is malformed'); continue }
    const [oName, oCommon, fams] = order
    // F5, F4, F10
    if (!okName(oName, ORDER_MAX)) out.push(`F5: order name ${JSON.stringify(oName)} is empty, over ${ORDER_MAX} or holds a control character`)
    if (orderSeen.has(oName)) out.push(`F4: order ${oName} appears twice`)
    orderSeen.add(oName)
    if (!okName(oCommon, ORDER_COMMON_MAX)) out.push(`F10: order ${oName} has common name ${JSON.stringify(oCommon)}, empty, over ${ORDER_COMMON_MAX} or holding a control character`)
    else if (!Object.hasOwn(orderNames, oName) || orderNames[oName] !== oCommon) out.push(`F10: order ${oName}'s common name "${oCommon}" is not ORDER_COMMON_NAMES' row`)
    for (const fam of fams) {
      if (!isArr(fam) || fam.length !== 5 || !isArr(fam[4])) { out.push(`a family tuple under ${oName} is malformed`); continue }
      families += 1
      const [code, com, sci, living, gens] = fam
      if (typeof code !== 'string' || !FAMILY_CODE_SHAPE_RE.test(code)) out.push(`F5: family code ${JSON.stringify(code)} fails ${FAMILY_CODE_SHAPE_RE}`)
      if (familyCodes.has(code)) out.push(`F4: family code ${code} appears twice`)
      familyCodes.add(code)
      if (!okName(com, FAMILY_COM_MAX)) out.push(`F5: family ${code} common name ${JSON.stringify(com)} out of bounds`)
      if (!okName(sci, FAMILY_SCI_MAX)) out.push(`F5: family ${code} scientific name ${JSON.stringify(sci)} out of bounds`)
      let famSpecies = 0
      let famExtinct = 0
      for (const gen of gens) {
        if (!isArr(gen) || (gen.length !== 2 && gen.length !== 3) || !isArr(gen[1]) || gen[1].length % 2 !== 0) { out.push(`a genus tuple under ${code} is malformed`); continue }
        genera += 1
        const [gName, list, gCommon] = gen
        if (!okName(gName, GENUS_MAX)) out.push(`F5: genus name ${JSON.stringify(gName)} out of bounds`)
        if (genusSeen.has(gName)) out.push(`F4: genus ${gName} appears twice`)
        genusSeen.add(gName)
        const spelled = []
        for (let i = 0; i < list.length; i += 2) {
          const name = list[i]
          const epithet = list[i + 1]
          if (!okName(name, SPECIES_NAME_MAX)) { out.push(`F5: species name ${JSON.stringify(name)} out of bounds`); continue }
          if (!okName(epithet, EPITHET_MAX)) out.push(`F5: epithet ${JSON.stringify(epithet)} of "${name}" out of bounds`)
          if (name !== name.toLowerCase()) out.push(`F2: species key "${name}" is not lowercase`)
          if (speciesSeen.has(name)) out.push(`F2: species "${name}" appears twice`)
          speciesSeen.add(name)
          flat.push(name)
          famSpecies += 1
          if (extinctSet.has(name)) famExtinct += 1
          // F7: the scientific name the asset builds equals the snapshot's for this species.
          const code7 = Object.hasOwn(snapshot.byCom, name) ? snapshot.byCom[name] : undefined
          const sciKey = `${gName} ${epithet}`.toLowerCase()
          if (code7 === undefined || !Object.hasOwn(snapshot.bySci, sciKey) || snapshot.bySci[sciKey] !== code7) {
            out.push(`F7: "${name}" builds scientific name "${gName} ${epithet}", which the snapshot does not give that species`)
          }
          spelled.push(code7 !== undefined && Object.hasOwn(snapshot.byCode, code7) ? snapshot.byCode[code7] : name)
        }
        // F11
        const expected = genusCommonName(gName, spelled, [])
        if (gen.length === 3) {
          if (!okName(gCommon, GENUS_COMMON_MAX)) out.push(`F11: genus ${gName} common name ${JSON.stringify(gCommon)} out of bounds`)
          else if (list.length / 2 < 2) out.push(`F11: genus ${gName} has one species and carries the name "${gCommon}"`)
          else if (leftUnnamed.includes(gName)) out.push(`F11: genus ${gName} is in GENUS_LEFT_UNNAMED and carries "${gCommon}"`)
          else if (gCommon !== expected) out.push(`F11: genus ${gName} carries "${gCommon}", the rule gives "${expected}"`)
        } else if (expected !== '' && !leftUnnamed.includes(gName)) {
          out.push(`F11: genus ${gName} carries no name where the rule gives "${expected}"`)
        }
      }
      // F6
      if (living !== famSpecies - famExtinct) out.push(`F6: family ${code} stores living ${String(living)}, its species less its extinct members are ${famSpecies - famExtinct}`)
    }
  }
  // F6: every extinct member is a species of the asset; the totals agree.
  for (const e of extinctSet) if (!speciesSeen.has(e)) out.push(`F6: extinct member "${e}" is not a species of the asset`)
  let livingSum = 0
  for (const order of asset.orders) if (isArr(order) && isArr(order[2])) for (const f of order[2]) if (isArr(f) && typeof f[3] === 'number') livingSum += f[3]
  if (livingSum + extinctSet.size !== flat.length) out.push(`F6: living ${livingSum} plus extinct ${extinctSet.size} is not the ${flat.length} species`)
  // F2: the species set equals the snapshot's byCom keys, both directions.
  const byCom = snapshot.byCom ?? {}
  for (const n of speciesSeen) if (!Object.hasOwn(byCom, n)) out.push(`F2: "${n}" is not a species name of the snapshot`)
  for (const n of Object.keys(byCom)) if (!speciesSeen.has(n)) out.push(`F2: snapshot species "${n}" is missing from the asset`)
  // F3: flattened, the snapshot's taxonomic order is strictly increasing.
  let prev = -Infinity
  for (const n of flat) {
    const o = Object.hasOwn(snapshot.byOrder ?? {}, n) ? snapshot.byOrder[n] : undefined
    if (typeof o !== 'number') continue
    if (!(o > prev)) { out.push(`F3: "${n}" (taxonomic order ${o}) does not follow the species before it (${prev}); a family, order or genus is not contiguous`); }
    prev = o
  }
  // F8
  if (families < floors.families) out.push(`F8: ${families} families, below the floor of ${floors.families}`)
  if (orderSeen.size < floors.orders) out.push(`F8: ${orderSeen.size} orders, below the floor of ${floors.orders}`)
  if (genera < floors.genera) out.push(`F8: ${genera} genera, below the floor of ${floors.genera}`)
  // F9
  const text = typeof json === 'string' ? json : JSON.stringify(asset)
  const gz = gzipSync(Buffer.from(text, 'utf8')).length
  if (gz > FAMILIES_GZIP_MAX_BYTES) out.push(`F9: ${gz} bytes gzipped, over the ${FAMILIES_GZIP_MAX_BYTES}-byte budget`)
  return out
}

// -- The read-through report (FR-91, schema 3.5) -----------------------------

/** Every named genus of an asset, genus name to common name. */
export function genusNames(asset) {
  const out = new Map()
  if (!asset || !isArr(asset.orders)) return out
  for (const o of asset.orders) for (const f of (isArr(o) && isArr(o[2]) ? o[2] : [])) {
    for (const g of (isArr(f) && isArr(f[4]) ? f[4] : [])) if (isArr(g) && g.length === 3) out.set(g[0], g[2])
  }
  return out
}

/**
 * The genus-name report the CLI prints after its counts: how many genera are
 * named, how many distinct names, and every name that is new or changed
 * against the committed asset (all of them on the first generation). A person
 * or the builder reads the new and changed names before the feature ships and
 * settles each awkward plural in one of the two closed lists, never in the
 * asset by hand. `committedText` is the committed asset's file text, or null.
 */
export function genusNameReport(asset, committedText) {
  const now = genusNames(asset)
  let before = new Map()
  if (typeof committedText === 'string') {
    try { before = genusNames(JSON.parse(committedText)) } catch { before = new Map() }
  }
  const changed = []
  for (const [g, n] of now) if (before.get(g) !== n) changed.push(`${g}: ${before.has(g) ? `"${before.get(g)}" -> ` : ''}"${n}"`)
  const dropped = []
  for (const [g, n] of before) if (!now.has(g)) dropped.push(`${g}: "${n}" (no longer named)`)
  const lines = [
    `  genus names: ${now.size} genera named, ${new Set(now.values()).size} distinct names; ` +
    `${changed.length} new or changed and ${dropped.length} dropped against the committed asset`,
  ]
  if (changed.length > 0 || dropped.length > 0) {
    lines.push('  READ THESE (FR-91): settle an awkward plural in GENUS_PLURAL_EXCEPTIONS or GENUS_LEFT_UNNAMED, re-run, and record it in the run\'s decisions.md')
    for (const c of [...changed, ...dropped]) lines.push(`    ${c}`)
  }
  return lines
}

/**
 * G5: each family's species in the derived asset equal an independent count
 * (a `Map` by family code over the response's species rows), and the
 * per-family tallies sum to the species rows.
 */
export function familyTallyViolations(taxonomy, asset) {
  const out = []
  const count = new Map()
  let rows = 0
  for (const t of taxonomy) {
    if (!isSpecies(t)) continue
    rows += 1
    count.set(t.familyCode, (count.get(t.familyCode) ?? 0) + 1)
  }
  let sum = 0
  for (const o of asset.orders) for (const f of o[2]) {
    let n = 0
    for (const g of f[4]) n += g[1].length / 2
    sum += n
    if (count.get(f[0]) !== n) out.push(`G5: family ${f[0]} holds ${n} species, the response's own count is ${String(count.get(f[0]))}`)
  }
  if (sum !== rows) out.push(`G5: per-family tallies sum to ${sum}, not the ${rows} species rows`)
  return out
}

/**
 * What the snapshot run writes for the family asset, or the violations that
 * stop the whole run. `snapshot` is the bundle the same run derives (and, in
 * the `all` mode, writes).
 */
export function planFamilies(taxonomy, snapshot, options = {}) {
  const live = liveFamilyViolations(taxonomy, options)
  if (live.length > 0) return { violations: live }
  const asset = deriveFamilies(taxonomy, { ...options, version: snapshot.version })
  const json = JSON.stringify(asset)
  const violations = [...familyTallyViolations(taxonomy, asset), ...checkFamilies(asset, snapshot, { ...options, json })]
  if (violations.length > 0) return { violations }
  return { violations: [], asset, json }
}
