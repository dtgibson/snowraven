// The pure core of `scripts/build-ebird-taxonomy.mjs` (species-code-search,
// schema.md 5.1). No `process`, no `fs`, no network, no app imports: the CLI
// fetches eBird's taxonomy, reads the committed snapshot and writes files, and
// `frontend/src/lib/alphaCodesGenerator.test.ts` drives this module over small
// in-memory fixtures. `checkAlphaCodes` at the bottom is the SAME checker the CI
// guard (`frontend/src/lib/alphaCodesAsset.test.ts`) runs over the committed
// asset, so the generator refuses to write anything CI would refuse.
//
// It derives two things from ONE live fetch:
//
//   1. The five taxonomy snapshot maps (`deriveSnapshotMaps`), moved verbatim
//      from the CLI's old `deriveBundle`. The twins `taxonomyService.ts` and
//      `backend/routers/taxonomy.py` derive the same five maps; neither names
//      this file.
//   2. The alpha-code asset `frontend/src/assets/ebird-alpha-codes.json`: every
//      published common name, lowercased, to the four-letter codes that row
//      answers to in Search and the species pickers.
//
// THE CODE RULE (decisions.md 2 to 6, schema.md 5.2). A row's codes are all of
// its eBird `bandingCodes`, plus only those `comNameCodes` formed from the
// common name SnowRaven shows (`nameFormedCodes`), where a code formed under
// another hyphen convention or from the name with its accents removed counts as
// a variant of that name. Codes eBird takes from a bird's OTHER names (British,
// international or former names: GOOS on Common Merganser, RODO on Rock Pigeon,
// GBHE on Green Heron, MYWA on the Yellow-rumped Warbler species) are dropped
// here, at build time, so the app never sees them. A code is never edited,
// added or folded, and `sciNameCodes` is never read.
//
// THE REVISION CHECK (schema.md 5.3). Codes are never generated from a newer
// taxonomy revision than the shipped snapshot: with the version unchanged, a
// live taxonomy whose five maps differ from the committed snapshot stops the run
// (`planTaxonomyRun` returns `stop`), and the annual revision procedure in
// `.claude/rules/bird-names.md` applies.
//
// FAIL CLOSED. Every check returns or carries violation messages; the CLI
// writes nothing unless the plan is a write plan.

import { gzipSync } from 'node:zlib'

/** Asset schema version. Any other value is a load failure in the app. */
export const ALPHA_CODES_ASSET_VERSION = 1

/**
 * The closed code alphabet (FR-04(c), OQ-01): A to Z plus O and U with a
 * diaeresis, written as escapes because a literal accented letter is invisible
 * in a diff (bird-names.md). Applied only to eBird's data, here and in CI.
 */
export const ALPHA_CODE_RE = /^[A-Z\u00D6\u00DC]{2,4}$/

/** The twelve `Object.prototype` member names FR-04(e) lists. */
export const PROTOTYPE_MEMBER_NAMES = Object.freeze([
  '__proto__',
  'constructor',
  'toString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
])

/**
 * Plausibility floor for entries carrying a code (I3). Measured 15,471 after
 * the American-name filter; deliberately ABOVE the 11,167 species, so a
 * derivation that dropped every non-species entry (and with them every form's
 * own code) is refused.
 */
export const MIN_ALPHA_CODE_ENTRIES = 13_000

/** Most hyphenated tokens one displayed name may carry (I11; measured 3). */
export const MAX_HYPHENATED_TOKENS = 4

/** The ONE spelling of the NFR-02 size bound: 200 KiB gzipped. */
export const ALPHA_CODES_GZIP_MAX_BYTES = 204_800

export const REVISION_MESSAGE =
  "eBird's taxonomy has moved past the shipped snapshot. Codes are never generated " +
  'from a newer taxonomy revision than the snapshot, so nothing was written. The ' +
  'annual-revision procedure in .claude/rules/bird-names.md applies: bump VERSION in ' +
  'scripts/build-ebird-taxonomy.mjs and CACHE_KEY in frontend/src/lib/tauri/taxonomyService.ts ' +
  'together, re-run this script, then scripts/build-taxonomy-history.mjs.'

const SNAPSHOT_MAPS = Object.freeze(['bySci', 'byCom', 'byOrder', 'byCode', 'reportAs'])

// ── The snapshot maps (moved verbatim from the CLI's deriveBundle) ──────────

/**
 * Mirror of taxonomyService.ts loadTaxonomy() / taxonomy.py
 * _derive_from_taxonomy(). Keep all three in lockstep:
 *   bySci    = sciName.lower() -> speciesCode   (species category only)
 *   byCom    = comName.lower() -> speciesCode   (species category only)
 *   byOrder  = comName.lower() -> taxonOrder    (species only, INTEGER)
 *   byCode   = speciesCode -> comName           (ALL categories, original case)
 *   reportAs = speciesCode -> reportAs parent   (ALL categories)
 */
export function deriveSnapshotMaps(taxonomy) {
  const bySci = {}
  const byCom = {}
  const byOrder = {}
  const byCode = {}
  const reportAs = {}

  for (const taxon of taxonomy) {
    const code = taxon.speciesCode ?? ''
    if (!code) continue
    byCode[code] = taxon.comName ?? ''
    if (taxon.reportAs) reportAs[code] = taxon.reportAs
    // Name -> code maps stay species-level (preserves /taxonomy/codes behavior).
    if (taxon.category !== 'species') continue
    const sci = (taxon.sciName ?? '').toLowerCase()
    const com = (taxon.comName ?? '').toLowerCase()
    if (sci) bySci[sci] = code
    if (com) {
      byCom[com] = code
      // INTEGER (matches backend int(order)); a straight copy is then value-identical.
      if (taxon.taxonOrder != null) byOrder[com] = Math.trunc(Number(taxon.taxonOrder))
    }
  }

  return { bySci, byCom, byOrder, byCode, reportAs }
}

/**
 * The snapshot bundle, in the key order the committed file has always had
 * (version, generated, then the five maps), so a regenerated snapshot's bytes
 * are unchanged.
 */
export function deriveBundle(taxonomy, { version, generated }) {
  return { version, generated, ...deriveSnapshotMaps(taxonomy) }
}

// ── The American-name rule (schema.md 5.2) ──────────────────────────────────

const PARENTHETICAL_RE = /\([^()]*\)/g
const APOSTROPHES_RE = /['\u2019]/g
const COMBINING_MARKS_RE = /[\u0300-\u036f]/g
const TOKEN_SPLIT_RE = /[\s/]+/
const EDGE_HYPHENS_RE = /^-+|-+$/g
const NON_LETTERS_RE = /[^\p{L}]/gu
const HAS_LETTER_RE = /\p{L}/u

/** The tokens of one spelling: split on whitespace and `/`, edge hyphens trimmed, letterless dropped. */
function tokensOf(spelling) {
  return spelling
    .split(TOKEN_SPLIT_RE)
    .map((t) => t.replace(EDGE_HYPHENS_RE, ''))
    .filter((t) => HAS_LETTER_RE.test(t))
}

const lettersOf = (word) => word.replace(NON_LETTERS_RE, '')

/** The standard four-letter rule on one word list (letters only, non-empty words). */
function standardCode(words) {
  const first = (w, n) => Array.from(w).slice(0, n).join('')
  if (words.length === 0) return ''
  if (words.length === 1) return first(words[0], 4)
  if (words.length === 2) return first(words[0], 2) + first(words[1], 2)
  if (words.length === 3) return first(words[0], 1) + first(words[1], 1) + first(words[2], 2)
  return words.slice(0, 4).map((w) => first(w, 1)).join('')
}

/** The spelling a name is formed from: parentheticals and apostrophes removed (steps 1 and 2). */
function baseSpelling(displayedName) {
  return String(displayedName).replace(PARENTHETICAL_RE, ' ').replace(APOSTROPHES_RE, '')
}

/** The accent-free variant (step 3, spelling B). */
function accentFree(spelling) {
  return spelling.normalize('NFD').replace(COMBINING_MARKS_RE, '').normalize('NFC')
}

/** How many tokens of the displayed name carry an inner hyphen (I11). */
export function hyphenatedTokenCount(displayedName) {
  return tokensOf(baseSpelling(displayedName)).filter((t) => t.includes('-')).length
}

/**
 * The codes the name SnowRaven shows forms (schema.md 5.2): the standard
 * four-letter rule over the name with its parentheticals and apostrophes
 * removed, under every hyphen convention (each hyphenated token SPLIT into its
 * parts or JOINED into one word) and on both the name as shown and the name
 * with its accents removed, plus the initials convention for a two-token name
 * whose second token is hyphenated. Uppercased. A published `comNameCodes`
 * member is kept only when it is in this set.
 *
 * Throws a RangeError for a name with more than MAX_HYPHENATED_TOKENS
 * hyphenated tokens (I11), so the 2^k enumeration stays small; the plan checks
 * I11 first and reports it as a violation rather than reaching this.
 */
export function nameFormedCodes(displayedName) {
  const out = new Set()
  const base = baseSpelling(displayedName)
  const spellings = new Set([base, accentFree(base)])
  for (const spelling of spellings) {
    const tokens = tokensOf(spelling)
    const hyphenated = tokens.filter((t) => t.includes('-'))
    if (hyphenated.length > MAX_HYPHENATED_TOKENS) {
      throw new RangeError(`"${displayedName}" has ${hyphenated.length} hyphenated tokens (most allowed: ${MAX_HYPHENATED_TOKENS})`)
    }
    const k = hyphenated.length
    for (let mask = 0; mask < 2 ** k; mask += 1) {
      const words = []
      let h = 0
      for (const token of tokens) {
        let parts
        if (token.includes('-')) {
          const join = (mask >> h) & 1
          h += 1
          parts = join ? [token.replaceAll('-', '')] : token.split('-')
        } else {
          parts = [token]
        }
        for (const p of parts) {
          const w = lettersOf(p)
          if (w) words.push(w)
        }
      }
      const code = standardCode(words)
      if (code) out.add(code.toUpperCase())
    }
    // Step 7, the initials convention: Common Wood-Pigeon COWP, Spotted
    // Whistling-Duck SPWD, Greater Prairie-Chicken GRPC.
    if (tokens.length === 2 && !tokens[0].includes('-') && tokens[1].includes('-')) {
      const parts = tokens[1].split('-').map(lettersOf).filter(Boolean)
      const firstWord = lettersOf(tokens[0])
      if (firstWord && parts.length >= 2) {
        const code = Array.from(firstWord).slice(0, 2).join('') + Array.from(parts[0])[0] + Array.from(parts[1])[0]
        out.add(code.toUpperCase())
      }
    }
  }
  return out
}

const codeList = (value) => (Array.isArray(value) ? value : [])

/**
 * The KEPT codes of one taxon entry (the filter, decisions.md 2): every
 * `bandingCodes` member, then each `comNameCodes` member that the displayed
 * name forms and that is not already present. Nothing else; `sciNameCodes` is
 * never read, and no code is edited.
 *
 * EACH GROUP IS SORTED BY CODE POINT, NOT KEPT IN PUBLISHED ORDER. eBird does
 * not hold the order of these arrays still: two fetches of the same taxonomy an
 * hour apart (2026-10-10) listed the same `comNameCodes` in a different order on
 * 1,164 entries. Published order would rewrite the asset on every regeneration
 * with nothing changed; sorting makes the same taxonomy derive the same bytes.
 * The app reads codes as a set, so order changes no match and no ranking.
 */
export function entryAlphaCodes(taxon) {
  const byCodePoint = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
  const banding = [...new Set(codeList(taxon.bandingCodes))].sort(byCodePoint)
  const formed = nameFormedCodes(taxon.comName ?? '')
  const named = [...new Set(codeList(taxon.comNameCodes))]
    .filter(c => formed.has(c) && !banding.includes(c))
    .sort(byCodePoint)
  return [...banding, ...named]
}

/**
 * The asset object. One pass in eBird's order over every entry with a
 * `speciesCode` (the same skip rule `byCode` uses, so the key set equals the
 * `byCode` value set, lowercased). The accumulator is a Map emitted through
 * Object.fromEntries, so a hostile name can never write a prototype here; I8
 * then refuses it. `entryCodes` is a test seam (a mutated filter must be
 * refused by I10); the CLI never passes it.
 */
export function deriveAlphaCodes(taxonomy, { version, generated, entryCodes = entryAlphaCodes }) {
  const acc = new Map()
  for (const taxon of taxonomy) {
    if (!(taxon.speciesCode ?? '')) continue
    acc.set((taxon.comName ?? '').toLowerCase(), entryCodes(taxon).join(' '))
  }
  return { v: ALPHA_CODES_ASSET_VERSION, version, generated, codes: Object.fromEntries(acc) }
}

// ── Checks ──────────────────────────────────────────────────────────────────

/** I4: published names equal ignoring case (each reported once). */
export function caseCollisions(taxonomy) {
  const seen = new Map()
  const out = []
  for (const taxon of taxonomy) {
    if (!(taxon.speciesCode ?? '')) continue
    const name = taxon.comName ?? ''
    const lc = name.toLowerCase()
    if (seen.has(lc) && seen.get(lc) !== name) out.push(`"${seen.get(lc)}" and "${name}" are equal ignoring case`)
    else if (!seen.has(lc)) seen.set(lc, name)
  }
  return out
}

/** I11: displayed names with more hyphenated tokens than the rule enumerates. */
export function hyphenShapeViolations(taxonomy) {
  const out = []
  for (const taxon of taxonomy) {
    if (!(taxon.speciesCode ?? '')) continue
    const name = taxon.comName ?? ''
    const k = Math.max(hyphenatedTokenCount(name), hyphenatedTokenCount(accentFree(baseSpelling(name))))
    if (k > MAX_HYPHENATED_TOKENS) out.push(`I11: "${name}" has ${k} hyphenated tokens (most allowed: ${MAX_HYPHENATED_TOKENS})`)
  }
  return out
}

/**
 * I10, generator only (it needs the live `bandingCodes`): every kept code is
 * one of the entry's `bandingCodes` or a `comNameCodes` member its displayed
 * name forms, and every `bandingCodes` member is kept. A self-check of the
 * filter against its own definition, written independently of
 * `entryAlphaCodes`.
 */
export function filterViolations(taxonomy, codes) {
  const out = []
  for (const taxon of taxonomy) {
    if (!(taxon.speciesCode ?? '')) continue
    const name = taxon.comName ?? ''
    const key = name.toLowerCase()
    const value = Object.hasOwn(codes, key) ? codes[key] : ''
    const kept = value === '' ? [] : value.split(' ')
    const banding = codeList(taxon.bandingCodes)
    const comName = codeList(taxon.comNameCodes)
    const formed = nameFormedCodes(name)
    for (const c of kept) {
      const ok = banding.includes(c) || (comName.includes(c) && formed.has(c))
      if (!ok) out.push(`I10: "${name}" keeps ${c}, which is neither a banding code nor formed from its name`)
    }
    for (const c of banding) {
      if (!kept.includes(c)) out.push(`I10: "${name}" drops its banding code ${c}`)
    }
  }
  return out
}

/**
 * The shared invariant checker (I1 to I3, I5 to I8), run by the generator over
 * what it would write and by CI over the committed asset. Returns every
 * violation found (empty when the asset is sound).
 *
 *   speciesNames    the snapshot's `byCom` keys (lowercased species names)
 *   publishedNames  the snapshot's `byCode` values, lowercased
 */
export function checkAlphaCodes(asset, { speciesNames, publishedNames, snapshotVersion, minEntries = MIN_ALPHA_CODE_ENTRIES }) {
  const out = []
  if (typeof asset !== 'object' || asset === null) return ['the asset is not an object']
  // I1
  if (asset.v !== ALPHA_CODES_ASSET_VERSION) out.push(`I1: v is ${String(asset.v)}, expected ${ALPHA_CODES_ASSET_VERSION}`)
  if (asset.version !== snapshotVersion) out.push(`I1: version "${String(asset.version)}" does not equal the snapshot version "${snapshotVersion}"`)
  const codes = asset.codes
  if (typeof codes !== 'object' || codes === null || Array.isArray(codes)) return [...out, 'codes is not an object']
  const keys = Object.keys(codes)
  // I8 (checked on own keys, including one that Object.keys would also list)
  for (const name of PROTOTYPE_MEMBER_NAMES) {
    if (Object.hasOwn(codes, name)) out.push(`I8: "${name}" is an own key`)
  }
  // I2, both directions
  const published = new Set(publishedNames)
  for (const k of keys) if (!published.has(k)) out.push(`I2: "${k}" is not a published common name`)
  for (const n of published) if (!Object.hasOwn(codes, n)) out.push(`I2: published name "${n}" has no entry`)
  let nonEmpty = 0
  for (const k of keys) {
    // I7
    if (k !== k.toLowerCase()) out.push(`I7: key "${k}" is not lowercase`)
    const value = codes[k]
    // I6
    if (typeof value !== 'string') {
      out.push(`I6: "${k}" has a non-string value`)
      continue
    }
    if (value === '') continue
    nonEmpty += 1
    const list = value.split(' ')
    if (new Set(list).size !== list.length) out.push(`I6: "${k}" repeats a code`)
    for (const c of list) {
      if (!ALPHA_CODE_RE.test(c) || c.normalize('NFC') !== c) out.push(`I6: "${k}" carries "${c}", outside the closed code alphabet`)
    }
  }
  // I3
  if (nonEmpty < minEntries) out.push(`I3: ${nonEmpty} entries carry a code, fewer than the floor of ${minEntries}`)
  // I5
  for (const s of speciesNames) {
    if (!Object.hasOwn(codes, s) || codes[s] === '') out.push(`I5: species "${s}" has no code`)
  }
  return out
}

/** I9 on the exact JSON text that would be written (gzip at zlib's default level). */
export function sizeViolations(json) {
  const gz = gzipSync(Buffer.from(json, 'utf8')).length
  return gz <= ALPHA_CODES_GZIP_MAX_BYTES ? [] : [`I9: ${gz} bytes gzipped, over the ${ALPHA_CODES_GZIP_MAX_BYTES}-byte budget`]
}

/**
 * The five snapshot maps that differ between the live derivation and the
 * committed snapshot, each with counts. Order-insensitive on purpose: a
 * reorder with the same content is not a revision.
 */
export function snapshotDrift(liveMaps, committed) {
  const out = []
  for (const name of SNAPSHOT_MAPS) {
    const live = liveMaps[name]
    const kept = committed?.[name]
    if (typeof kept !== 'object' || kept === null || Array.isArray(kept)) {
      out.push(`${name}: missing from the committed snapshot`)
      continue
    }
    const liveKeys = Object.keys(live)
    const keptCount = Object.keys(kept).length
    let differ = 0
    for (const k of liveKeys) if (!Object.hasOwn(kept, k) || kept[k] !== live[k]) differ += 1
    if (differ > 0 || liveKeys.length !== keptCount) {
      out.push(`${name}: ${differ} of ${liveKeys.length} live keys differ (committed has ${keptCount})`)
    }
  }
  return out
}

/**
 * Decide what one run writes (schema.md 5.3). Never throws for a data problem.
 *
 *   live       the live eBird taxonomy (an array)
 *   committed  the committed snapshot FILE TEXT, or null when the file is absent
 *   version    the CLI's hand-bumped VERSION
 *   generated  the provenance date
 *
 * Returns `{ mode: 'stop', messages }`, or a write plan
 * `{ mode: 'codes-only' | 'all', bundle, alphaCodes, alphaCodesJson }`.
 */
export function planTaxonomyRun({ live, committed, version, generated, minEntries = MIN_ALPHA_CODE_ENTRIES, entryCodes }) {
  const stop = (messages) => ({ mode: 'stop', messages })

  let mode = 'all'
  if (committed !== null && committed !== undefined) {
    let snapshot
    try {
      snapshot = JSON.parse(committed)
    } catch {
      return stop(['The committed snapshot frontend/src/assets/ebird-taxonomy.json is not parseable JSON.'])
    }
    if (typeof snapshot === 'object' && snapshot !== null && snapshot.version === version) {
      const drift = snapshotDrift(deriveSnapshotMaps(live), snapshot)
      if (drift.length > 0) return stop([`${REVISION_MESSAGE} Shipped snapshot version: ${version}.`, ...drift])
      mode = 'codes-only'
    }
  }

  const collisions = caseCollisions(live)
  const shapes = hyphenShapeViolations(live)
  if (collisions.length > 0 || shapes.length > 0) return stop([...collisions.map((c) => `I4: ${c}`), ...shapes])

  const bundle = deriveBundle(live, { version, generated })
  const alphaCodes = deriveAlphaCodes(live, { version, generated, entryCodes })
  const speciesNames = Object.keys(bundle.byCom)
  const publishedNames = Object.values(bundle.byCode).map((n) => n.toLowerCase())
  const alphaCodesJson = JSON.stringify(alphaCodes)
  const violations = [
    ...checkAlphaCodes(alphaCodes, { speciesNames, publishedNames, snapshotVersion: bundle.version, minEntries }),
    ...filterViolations(live, alphaCodes.codes),
    ...sizeViolations(alphaCodesJson),
  ]
  if (violations.length > 0) return stop(violations)
  return { mode, bundle, alphaCodes, alphaCodesJson }
}
