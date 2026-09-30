// The "Copy iCloud details" report (icloud-bar-chart-sync decisions.md entry
// 20). A DIAGNOSTIC for the bar-chart sync failure on the user's devices
// (TestFlight 1.0.40.5), to be kept or removed once that fix lands.
//
// Pure: no React, no Tauri, no storage. The controller gathers its inputs (the
// native `icloud_diagnostics` payload, the state store, the preference, the
// bar-chart manifest and a few controller counters) and Settings copies the
// result to the clipboard through the `copyText` seam. Nothing here leaves the
// device on its own, and the text only ever goes to the clipboard.
//
// ALLOWED FIELDS ONLY. The native payload is treated as untrusted input: the
// builder reads the fields it names, each through a type check and a bound,
// and everything else is dropped, so a field added natively cannot reach the
// report by accident. What it may carry: the app version and build, the
// platform, device names and the app's random device id, whether an iCloud
// account token is present and the container resolves, county codes, item
// names derived from them, sizes, dates, sync states and Apple's error codes
// and descriptions. What it never carries: a byte of any file, a filename the
// user chose, a digest, an API key.
//
// SIZE BOUND. At most MAX_REPORT_CHARS (64,000) UTF-16 code units; a longer
// report is cut at a line boundary and ends with TRUNCATED_NOTE. Every string
// is also bounded on its own (MAX_TEXT) and every list is capped, so the work
// done is bounded whatever the payload holds.

import type { BarChartFilesStatus } from '../storage'
import { isRegionCode } from '../regionCode'
import type { ICloudState, SlotView } from './icloudState'

/** The whole report, in UTF-16 code units. */
export const MAX_REPORT_CHARS = 64_000
/** Any one string taken from an input. */
const MAX_TEXT = 160
/** Counties in the per-county section. */
const MAX_COUNTIES = 64
/** Items per container folder (the native scan's own bound is the same). */
const MAX_ITEMS = 48
/** Unrecognized names per folder, staging entries, duplicate folders. */
const MAX_OTHER = 8
const MAX_STAGING = 16
const MAX_DUPLICATES = 8
/** Native operations and per-county last-operation rows. */
const MAX_OPS = 20
const MAX_LAST = 64
/** Local bar-chart files. */
const MAX_LOCAL = 48

export const TRUNCATED_NOTE = `[Report cut at ${MAX_REPORT_CHARS} characters.]`

export interface DetailsInput {
  /** When the report was built (the controller's clock). */
  generatedAt: string
  /** The `icloud_diagnostics` payload, untrusted; null when it could not be read. */
  native: unknown
  /** Why the payload could not be read (a closed-union code), else null. */
  nativeError: string | null
  state: Pick<
    ICloudState,
    | 'availability' | 'syncEnabled' | 'deviceId' | 'deviceLabel' | 'platform' | 'lastCheckAt' | 'checking'
    | 'checkFailed' | 'barCharts' | 'sharedCountyCodes' | 'sharedDayObsExists' | 'slots'
  >
  pref: {
    enabled: boolean
    pendingCountyClears?: Readonly<Record<string, string>>
    knownSharedCounties?: Readonly<Record<string, unknown>>
  }
  /** The bar-chart manifest, or null when it could not be read. */
  manifest: BarChartFilesStatus | null
  controller: {
    checksRun: number
    uploadRechecks: number
    checkPending: boolean
    checkInFlight: boolean
    checkQueued: boolean
    repairedCounties: readonly string[]
  }
}

// ── bounded readers over untrusted values ──────────────────────────────────

/** C0, DEL, C1, the line and paragraph separators, and the bidirectional
 *  marks and overrides: none of them belongs in a pasted report. Code
 *  points, not a regex, as in icloudRecord.ts. */
function stripped(code: number): boolean {
  return code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029
    || code === 0x200e || code === 0x200f || (code >= 0x202a && code <= 0x202e) || (code >= 0x2066 && code <= 0x2069)
}

function isHighSurrogate(code: number): boolean {
  return code >= 0xd800 && code <= 0xdbff
}

/** A string with the characters above removed, trimmed, and at most `max`
 *  UTF-16 code units, never ending on half a surrogate pair. */
export function clean(s: string, max = MAX_TEXT): string {
  // Bound the input first, so a hostile string costs at most a few times `max`.
  let src = s.slice(0, max * 4)
  if (src.length > 0 && isHighSurrogate(src.charCodeAt(src.length - 1))) src = src.slice(0, -1)
  let t = ''
  for (let i = 0; i < src.length; i++) if (!stripped(src.charCodeAt(i))) t += src[i]
  t = t.trim()
  if (t.length <= max) return t
  const end = isHighSurrogate(t.charCodeAt(max - 1)) ? max - 1 : max
  return t.slice(0, end)
}

function obj(v: unknown): Record<string, unknown> | null {
  return typeof v === 'object' && v !== null && !Array.isArray(v) ? (v as Record<string, unknown>) : null
}

function field(o: Record<string, unknown> | null, key: string): unknown {
  return o && Object.hasOwn(o, key) ? o[key] : undefined
}

function str(o: Record<string, unknown> | null, key: string, max = MAX_TEXT): string | null {
  const v = field(o, key)
  return typeof v === 'string' ? clean(v, max) : null
}

function num(o: Record<string, unknown> | null, key: string): number | null {
  const v = field(o, key)
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function bool(o: Record<string, unknown> | null, key: string): boolean | null {
  const v = field(o, key)
  return typeof v === 'boolean' ? v : null
}

function list(o: Record<string, unknown> | null, key: string, max: number): Record<string, unknown>[] {
  const v = field(o, key)
  if (!Array.isArray(v)) return []
  const out: Record<string, unknown>[] = []
  for (const e of v.slice(0, max)) {
    const r = obj(e)
    if (r) out.push(r)
  }
  return out
}

function yn(b: boolean | null): string {
  return b === null ? '-' : b ? 'yes' : 'no'
}

/** Epoch milliseconds as ISO text, or '-' for anything that is not a real instant. */
function isoMs(ms: number | null): string {
  if (ms === null || Math.abs(ms) > 8.64e15) return '-'
  return new Date(ms).toISOString()
}

/** An ISO string already in an input, bounded; '-' when absent. */
function isoText(v: unknown): string {
  return typeof v === 'string' ? clean(v, 40) : '-'
}

function bytes(n: number | null): string {
  if (n === null) return '-'
  return n === 1 ? '1 byte' : `${n} bytes`
}

function device(label: string | null, platform: string | null): string {
  if (!label && !platform) return 'unknown device'
  return platform ? `${label ?? 'unnamed'} (${platform})` : (label ?? 'unnamed')
}

// ── the parts of the native payload ─────────────────────────────────────────

function errorText(v: unknown, depth = 1): string | null {
  const e = obj(v)
  if (!e) return null
  const code = num(e, 'code')
  let s = `${str(e, 'domain', 64) ?? 'unknown domain'} ${code ?? '-'}: ${str(e, 'description') ?? ''}`.trimEnd()
  if (depth > 0) {
    const under = errorText(field(e, 'underlying'), depth - 1)
    if (under) s += ` (underlying: ${under})`
  }
  return s
}

function valuesText(v: unknown): string[] {
  const x = obj(v)
  if (!x) return ['resource values: not read']
  const line = [
    `ubiquitous ${yn(bool(x, 'isUbiquitous'))}`,
    `uploaded ${yn(bool(x, 'uploaded'))}`,
    `uploading ${yn(bool(x, 'uploading'))}`,
    `downloading ${yn(bool(x, 'downloading'))}`,
    `status ${str(x, 'downloadStatus', 32) ?? '-'}`,
    `conflicts ${yn(bool(x, 'hasUnresolvedConflicts'))}`,
    `conflict versions ${num(x, 'conflictVersions') ?? '-'}`,
    `excluded ${yn(bool(x, 'excludedFromSync'))}`,
  ].join(', ')
  const out = [line]
  const up = errorText(field(x, 'uploadError'))
  if (up) out.push(`upload error: ${up}`)
  const down = errorText(field(x, 'downloadError'))
  if (down) out.push(`download error: ${down}`)
  const read = errorText(field(x, 'readError'))
  if (read) out.push(`resource values could not be read: ${read}`)
  return out
}

function recordText(v: unknown): string | null {
  const r = obj(v)
  if (!r) return null
  if (bool(r, 'readable') !== true) return 'record: not readable as JSON'
  const state = str(r, 'state', 16) ?? '-'
  const who = device(str(r, 'originLabel', 64), str(r, 'originPlatform', 8))
  const id = str(r, 'originDeviceId', 32)
  const at = state === 'cleared' ? `cleared ${isoText(field(r, 'clearedAt'))}` : `uploaded ${isoText(field(r, 'uploadedAt'))}`
  const size = num(r, 'byteLength')
  return `record: ${state} from ${who}${id ? ` [${id}]` : ''}, ${at}${size !== null ? `, ${bytes(size)}` : ''}`
}

function itemLines(v: Record<string, unknown>, indent: string): string[] {
  const name = str(v, 'name', 64) ?? '(unnamed)'
  const role = str(v, 'role', 24)
  const head = `${indent}${name}${role && role !== 'file' && role !== 'folder' ? ` (${role})` : ''}: ${str(v, 'onDisk', 32) ?? '-'}, ${bytes(num(v, 'size'))}, modified ${isoMs(num(v, 'modifiedMs'))}`
  const out = [head]
  for (const l of valuesText(field(v, 'values'))) out.push(`${indent}  ${l}`)
  const rec = recordText(field(v, 'record'))
  if (rec) out.push(`${indent}  ${rec}`)
  return out
}

function otherText(v: Record<string, unknown>): string {
  return `${str(v, 'name', 64) ?? '(unnamed)'} (${str(v, 'kind', 16) ?? '-'}, ${bytes(num(v, 'size'))}, modified ${isoMs(num(v, 'modifiedMs'))})`
}

function dirLines(label: string, d: Record<string, unknown> | null): string[] {
  if (!d) return [`  ${label}: not scanned`]
  const out: string[] = []
  const folder = obj(field(d, 'folder'))
  if (folder) {
    out.push(`  ${label} folder: ${str(folder, 'onDisk', 32) ?? '-'}, modified ${isoMs(num(folder, 'modifiedMs'))}`)
    for (const l of valuesText(field(folder, 'values'))) out.push(`    ${l}`)
  }
  const items = list(d, 'items', MAX_ITEMS)
  if (items.length === 0) out.push('    (no items)')
  for (const it of items) out.push(...itemLines(it, '    '))
  const more = num(d, 'itemsMore')
  if (more) out.push(`    ${more} more items not listed`)
  const other = list(d, 'other', MAX_OTHER)
  const otherMore = num(d, 'otherMore') ?? 0
  if (other.length > 0 || otherMore > 0) {
    out.push(`    Unrecognized entries: ${other.map(otherText).join('; ')}${otherMore ? `; and ${otherMore} more` : ''}`)
  }
  if (bool(d, 'scanTruncated')) out.push(`    The scan stopped at its entry bound.`)
  return out
}

// ── the report ──────────────────────────────────────────────────────────────

function viewText(v: SlotView | null | undefined): string {
  if (!v) return 'none'
  const parts = [clean(String(v.state), 32)]
  parts.push(v.fromThisDevice ? 'from this device' : `from ${device(v.origin ? clean(v.origin.label, 64) : null, v.origin ? clean(v.origin.platform, 8) : null)}`)
  if (v.uploadedAt) parts.push(`uploaded ${clean(v.uploadedAt, 40)}`)
  if (v.replacedAt) parts.push(`replaced ${clean(v.replacedAt, 40)}`)
  if (v.reason) parts.push(`reason: ${clean(v.reason)}`)
  return parts.join(', ')
}

function lastText(v: unknown): string {
  const l = obj(v)
  if (!l) return 'none'
  return `${isoMs(num(l, 'atMs'))} ${str(l, 'result') ?? '-'}`
}

function containerStatus(it: Record<string, unknown> | undefined): string {
  if (!it) return 'nothing under the name'
  const x = obj(field(it, 'values'))
  const parts = [`${str(it, 'onDisk', 32) ?? '-'}`]
  const size = num(it, 'size')
  if (size !== null) parts.push(bytes(size))
  parts.push(`uploaded ${yn(bool(x, 'uploaded'))}`, `status ${str(x, 'downloadStatus', 32) ?? '-'}`)
  const up = obj(field(x, 'uploadError'))
  if (up) parts.push(`upload error ${str(up, 'domain', 64) ?? '-'} ${num(up, 'code') ?? '-'}`)
  const down = obj(field(x, 'downloadError'))
  if (down) parts.push(`download error ${str(down, 'domain', 64) ?? '-'} ${num(down, 'code') ?? '-'}`)
  if (bool(x, 'hasUnresolvedConflicts')) parts.push('unresolved conflicts')
  return parts.join(', ')
}

export function buildICloudReport(input: DetailsInput): string {
  const out: string[] = []
  const n = obj(input.native)
  const scan = obj(field(n, 'scan'))
  const container = obj(field(scan, 'container'))
  const local = obj(field(scan, 'local'))
  const barcharts = obj(field(container, 'barcharts'))
  const s = input.state

  out.push('SnowRaven iCloud details')
  out.push(`Generated ${clean(input.generatedAt, 40)}. No file contents, file names you chose or API keys are included.`)
  out.push('')

  out.push('App')
  if (n) {
    const build = str(n, 'bundleBuild', 32)
    const version = str(n, 'bundleVersion', 32)
    out.push(`  SnowRaven ${str(n, 'appVersion', 32) ?? '-'} (bundle ${version ?? '-'}, build ${build ?? '-'}) on ${str(n, 'platform', 16) ?? '-'}`)
    out.push(`  Device name: ${str(n, 'deviceLabel', 64) ?? '-'}`)
  } else {
    out.push(`  Platform: ${s.platform ? clean(s.platform, 16) : '-'}. Device name: ${clean(s.deviceLabel, 64) || '-'}`)
  }
  out.push(`  Device id (random, this app's own): ${s.deviceId ? clean(s.deviceId, 32) : 'none yet'}`)
  out.push('')

  out.push('iCloud')
  if (scan) {
    out.push(`  Availability: ${str(scan, 'availability', 32) ?? '-'}. Account token present: ${yn(bool(scan, 'identityTokenPresent'))}. Container resolves: ${yn(bool(scan, 'containerResolves'))}. Build can use iCloud: ${yn(bool(scan, 'buildCanUseIcloud'))}.`)
  }
  out.push(`  This device's view: ${clean(s.availability, 32)}. Sync on: ${yn(s.syncEnabled)}. Last check: ${s.lastCheckAt ? clean(s.lastCheckAt, 40) : 'never'}. Last check failed: ${yn(s.checkFailed)}. Checking now: ${yn(s.checking)}.`)
  const c = input.controller
  const repaired = c.repairedCounties.filter(isRegionCode).slice(0, MAX_COUNTIES)
  out.push(`  Checks this session: ${c.checksRun}. Follow-up re-reads in a row: ${c.uploadRechecks}. Last check left something on its way: ${yn(c.checkPending)}. Check running: ${yn(c.checkInFlight)}, queued: ${yn(c.checkQueued)}.`)
  out.push(`  Counties whose file was written again this session: ${repaired.length > 0 ? repaired.join(', ') : 'none'}.`)
  out.push(`  iCloud holds day-by-day answers: ${yn(s.sharedDayObsExists)}.`)
  const scanError = str(n, 'scanError', 32)
  if (input.nativeError || scanError) {
    out.push(`  Native details could not be read in full: ${clean(input.nativeError ?? scanError ?? 'unknown', 32)}.`)
  } else if (!n) {
    out.push('  Native details are not available on this build.')
  }
  out.push('')

  // ── per county ─────────────────────────────────────────────────────────
  const fileByName = new Map<string, Record<string, unknown>>()
  for (const it of list(barcharts, 'items', MAX_ITEMS)) {
    const name = str(it, 'name', 64)
    if (name) fileByName.set(name, it)
  }
  const localByName = new Map<string, Record<string, unknown>>()
  for (const f of list(local, 'barcharts', MAX_LOCAL)) {
    const name = str(f, 'name', 64)
    if (name) localByName.set(name, f)
  }
  const lastByCounty = new Map<string, Record<string, unknown>>()
  for (const l of list(n, 'lastOps', MAX_LAST)) {
    const county = str(l, 'county', 16)
    if (county && isRegionCode(county)) lastByCounty.set(county, l)
  }
  const manifest = input.manifest?.counties ?? null
  const pending = input.pref.pendingCountyClears ?? {}
  const known = input.pref.knownSharedCounties ?? {}
  const codes = new Set<string>()
  const add = (code: string) => { if (isRegionCode(code)) codes.add(code) }
  Object.keys(s.barCharts).forEach(add)
  if (manifest) Object.keys(manifest).forEach(add)
  Object.keys(pending).forEach(add)
  Object.keys(known).forEach(add)
  s.sharedCountyCodes.forEach(add)
  for (const name of [...fileByName.keys(), ...localByName.keys()]) {
    const m = /^(US-[A-Z]{2}-[0-9]{3})\.(txt|record\.json)$/.exec(name)
    if (m) add(m[1])
  }
  lastByCounty.forEach((_, code) => add(code))
  const sorted = [...codes].sort()
  out.push(`Bar-chart counties (${sorted.length})`)
  if (sorted.length === 0) out.push('  none')
  for (const code of sorted.slice(0, MAX_COUNTIES)) {
    out.push(`  ${code}`)
    const view = Object.hasOwn(s.barCharts, code) ? s.barCharts[code] : null
    out.push(`    This device's view: ${viewText(view)}`)
    const entry = manifest && Object.hasOwn(manifest, code) ? manifest[code] : null
    if (input.manifest === null) out.push('    Local manifest: could not be read')
    else if (!entry) out.push('    Local manifest: no entry')
    else {
      const o = entry.origin
      const parts = [`uploaded ${clean(entry.uploadedAt, 40)}`]
      if (o) parts.push(`from ${device(clean(o.label, 64), clean(o.platform, 8))} [${clean(o.deviceId, 32)}]`)
      if (entry.replacedBySyncAt) parts.push(`replaced by sync ${clean(entry.replacedBySyncAt, 40)}`)
      out.push(`    Local manifest: ${parts.join(', ')}`)
    }
    const lf = localByName.get(`${code}.txt`)
    out.push(`    Local file: ${lf ? `${str(lf, 'kind', 16) ?? '-'}, ${bytes(num(lf, 'size'))}, modified ${isoMs(num(lf, 'modifiedMs'))}` : 'none'}`)
    out.push(`    In iCloud, file: ${containerStatus(fileByName.get(`${code}.txt`))}`)
    const rec = fileByName.get(`${code}.record.json`)
    const recLine = recordText(field(rec ?? null, 'record'))
    out.push(`    In iCloud, record: ${containerStatus(rec)}${recLine ? `; ${recLine}` : ''}`)
    out.push(`    Pending removal marker: ${Object.hasOwn(pending, code) ? clean(String(pending[code]), 40) : 'none'}. Known as a shared file: ${yn(Object.hasOwn(known, code))}.`)
    const last = lastByCounty.get(code) ?? null
    out.push(`    Last push: ${lastText(field(last, 'push'))}. Last pull: ${lastText(field(last, 'pull'))}. Last removal marker: ${lastText(field(last, 'clear'))}.`)
  }
  if (sorted.length > MAX_COUNTIES) out.push(`  ${sorted.length - MAX_COUNTIES} more counties not listed`)
  out.push('')

  // ── the native operation log ─────────────────────────────────────────
  out.push('Native bar-chart operations (oldest first)')
  const ops = list(n, 'ops', MAX_OPS)
  if (ops.length === 0) out.push(n ? '  none since the app started' : '  not available')
  for (const op of ops) {
    const count = num(op, 'count')
    const detail = str(op, 'detail')
    out.push(`  ${isoMs(num(op, 'atMs'))} ${str(op, 'op', 16) ?? '-'} ${str(op, 'target', 64) ?? '-'}: ${str(op, 'result', 64) ?? '-'}${detail ? ` (${detail})` : ''}${count && count > 1 ? ` x${count}` : ''}`)
  }
  out.push('')

  // ── the container ────────────────────────────────────────────────────
  out.push('iCloud container')
  if (!container) {
    out.push(scan ? '  The container did not resolve, so nothing was scanned.' : '  Not scanned.')
  } else {
    const docs = obj(field(container, 'documents'))
    if (docs) {
      out.push(`  Documents folder: ${str(docs, 'onDisk', 32) ?? '-'}`)
      for (const l of valuesText(field(docs, 'values'))) out.push(`    ${l}`)
    }
    out.push('  Control item (the synced eBird backup):')
    for (const it of list(container, 'control', 4)) out.push(...itemLines(it, '    '))
    out.push(`    This device's view of it: ${viewText(s.slots.ebird)}`)
    out.push(...dirLines('barcharts', barcharts))
    const dups = list(container, 'duplicates', MAX_DUPLICATES)
    out.push(dups.length === 0 ? '  Duplicate folders: none' : '  Duplicate folders:')
    for (const d of dups) out.push(...itemLines(d, '    '))
    const staging = obj(field(container, 'staging'))
    const staged = list(staging, 'barchart', MAX_STAGING)
    const stagedMore = num(staging, 'barchartMore') ?? 0
    out.push(`  Staging entries: ${num(staging, 'total') ?? 0} in all, ${staged.length + stagedMore} for bar charts${staged.length > 0 ? `: ${staged.map(otherText).join('; ')}` : ''}${stagedMore ? `; and ${stagedMore} more` : ''}`)
    out.push(...dirLines('day-obs', obj(field(container, 'dayObs'))))
    out.push(`  Other entries in Documents: ${num(container, 'documentsOther') ?? 0}`)
  }
  out.push('')

  // ── the local store ──────────────────────────────────────────────────
  out.push('This device\'s own copies')
  if (!local) {
    out.push('  Not scanned.')
  } else {
    const lf = (v: unknown) => {
      const f = obj(v)
      return f ? `${str(f, 'kind', 16) ?? '-'}, ${bytes(num(f, 'size'))}, modified ${isoMs(num(f, 'modifiedMs'))}` : 'none'
    }
    out.push(`  eBird backup: ${lf(field(local, 'ebirdFile'))}`)
    out.push(`  Day-by-day answers: ${lf(field(local, 'dayObsFile'))}`)
    out.push(`  Bar-chart folder: ${yn(bool(local, 'barchartsFolder'))}`)
    for (const f of list(local, 'barcharts', MAX_LOCAL)) out.push(`    ${str(f, 'name', 64) ?? '(unnamed)'}: ${lf(f)}`)
    const more = num(local, 'barchartsMore')
    if (more) out.push(`    ${more} more files not listed`)
    const other = num(local, 'barchartsOther')
    if (other) out.push(`    Other entries: ${other}`)
  }
  if (input.manifest) {
    out.push(`  Bar-chart manifest entries: ${Object.keys(input.manifest.counties).filter(isRegionCode).length}`)
  }

  return bound(out.join('\n'))
}

/** At most MAX_REPORT_CHARS, cut at a line boundary with TRUNCATED_NOTE. */
function bound(text: string): string {
  if (text.length <= MAX_REPORT_CHARS) return text
  const room = MAX_REPORT_CHARS - TRUNCATED_NOTE.length - 1
  const cut = text.lastIndexOf('\n', room)
  return `${text.slice(0, cut > 0 ? cut : room)}\n${TRUNCATED_NOTE}`
}
