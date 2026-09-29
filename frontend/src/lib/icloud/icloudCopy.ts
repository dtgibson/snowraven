// Every user-facing string of the iCloud Sync feature (design-spec.md Content
// Notes, the complete set), in one module so the em-dash and copy sweeps see
// all of it and Settings.tsx stays lean. Pure; no React, no seams.
// No em dash (U+2014) anywhere in this file's strings (repo rule).

import type { OriginPlatform } from './icloudRecord'
import type { Availability, KeySlotState, SlotState } from './icloudState'
import type { ICloudError } from './icloudNativeTypes'
import type { KeySlot } from './keyRecord'
import { counted } from '../targets/targetsCopy'

export const ICS_HEADER = 'iCloud Sync'
export const ICS_DESCRIPTION =
  'Keeps your eBird backup, ML export and eBird bar-chart files the same on every Mac, iPhone and iPad signed in to your iCloud account.'

/** FR-03 notes, the contract's exact strings. */
export const AVAILABILITY_NOTES: Record<Exclude<Availability, 'available' | 'unknown'>, string> = {
  'not-signed-in': 'Sign in to iCloud in System Settings (or Settings on iPhone and iPad) to use sync.',
  'drive-off-or-unauthorized':
    'Allow SnowRaven under iCloud Drive in the system settings. If it is already allowed, this build cannot use iCloud.',
  'build-cannot-use-icloud': 'This build cannot use iCloud.',
}

/** FR-24: the eight state labels, as text. */
export const STATE_LABELS: Record<SlotState, string> = {
  'up-to-date': 'Up to date',
  uploading: 'Syncing, uploading',
  downloading: 'Syncing, downloading',
  'in-icloud-not-downloaded': 'In iCloud, not downloaded here',
  'waiting-to-upload': 'Waiting to upload',
  unavailable: 'iCloud unavailable',
  off: 'Sync off',
  error: 'Could not sync',
}

export const PLATFORM_WORD: Record<OriginPlatform, string> = { mac: 'Mac', iphone: 'iPhone', ipad: 'iPad' }

/** "this Mac" / "this iPhone" / "this iPad" for the dialogs; "this device" before the platform is known. */
export function hereWord(platform: OriginPlatform | null): string {
  return platform ? `this ${PLATFORM_WORD[platform]}` : 'this device'
}

/**
 * One naming rule for a device everywhere (design-spec.md Provenance rule):
 * the label plus " (Mac)" / " (iPhone)" / " (iPad)", EXCEPT when the label
 * already is the platform word (iOS 16+ reports the generic name), in which
 * case the parenthetical is dropped: "Dave's Mac (Mac)", "iPhone".
 */
export function devName(origin: { label: string; platform: OriginPlatform }): string {
  const word = PLATFORM_WORD[origin.platform]
  return origin.label === word ? origin.label : `${origin.label} (${word})`
}

export function fromText(fromThisDevice: boolean, origin?: { label: string; platform: OriginPlatform }): string {
  if (fromThisDevice || !origin) return 'From this device'
  return `From ${devName(origin)}`
}

export function fromWithTimeText(
  fromThisDevice: boolean,
  origin: { label: string; platform: OriginPlatform } | undefined,
  formattedTime: string,
): string {
  return `${fromText(fromThisDevice, origin)}, uploaded ${formattedTime}`
}

/** FR-25 line; takes the place of the provenance fragment while set. */
export function replacedText(origin: { label: string; platform: OriginPlatform } | undefined, formattedTime: string): string {
  const who = origin ? devName(origin) : 'another device'
  return `Replaced by the file from ${who}, uploaded ${formattedTime}`
}

/** "Could not sync" reasons: the closed error union to one sentence each, no Apple text. */
export const REASONS: Record<ICloudError, string> = {
  mismatch: 'The file in iCloud did not download completely.',
  timeout: 'iCloud did not respond in time.',
  absent: 'The file is no longer in iCloud.',
  'too-large': 'The file in iCloud is too large to sync.',
  'local-missing': 'The file on this device could not be read.',
  'not-downloaded': 'The file in iCloud has not downloaded to this device yet.',
  unavailable: 'iCloud could not be read.',
  unknown: 'iCloud could not be read.',
}

export function reasonFor(code: ICloudError): string {
  return Object.hasOwn(REASONS, code) ? REASONS[code] : REASONS.unknown
}

/** Status row. */
export const STATUS_NEVER = 'Never checked'
export function statusText(formattedLastCheck: string | null): string {
  return formattedLastCheck ? `Last checked ${formattedLastCheck}` : STATUS_NEVER
}
export const CHECK_FAILED_SUFFIX = 'Could not reach iCloud.'

/** The one-shot announcer after a user-pressed Check now. */
export function announcerText(outcome: { ok: boolean; transferred: boolean }, formattedAt: string | null): string {
  if (!outcome.ok || !formattedAt) return CHECK_FAILED_SUFFIX
  return outcome.transferred ? `Checked ${formattedAt}.` : `Checked ${formattedAt}. Nothing to transfer.`
}

/** Buttons. */
export const BUTTONS = {
  checkNow: 'Check now',
  checking: 'Checking…',
  remove: 'Remove synced files from iCloud',
  removeKeys: 'Remove synced keys from iCloud',
  downloadNow: 'Download now',
  retry: 'Retry',
  cancel: 'Cancel',
  turnOn: 'Turn on',
  removeConfirm: 'Remove from iCloud',
  clearConfirm: 'Clear from all synced devices',
  /** icloud-bar-chart-sync: the Targets Remove and the Settings clear-all, with sync on. */
  removeAllSynced: 'Remove from all synced devices',
} as const

/** Enable note (FR-08): four required elements. */
export const ENABLE_TITLE = 'Turn on iCloud Sync'
export function enableNoteItems(here: string): { lead: string; text: string }[] {
  return [
    {
      lead: 'What goes to iCloud',
      text: `Your eBird backup, your Macaulay Library export and every eBird bar-chart file you have added on the Targets tab, along with each file's name, when it was uploaded, which device it came from (its name), its size and a checksum. The day-by-day eBird answers behind the Targets tab's live counts go too, so your other devices do not ask eBird again. Your settings and other caches stay on ${here}, and so do your API keys unless you also turn on Sync API keys.`,
    },
    {
      lead: 'Whose account',
      text: "Your own iCloud account, on Apple's servers. SnowRaven has no server of its own, so the files never pass through one, and the developer cannot see them.",
    },
    {
      lead: 'What happens now',
      text: `If iCloud already holds a newer copy of a file, it replaces the copy on ${here}. If the copy here is newer, it goes up to iCloud.`,
    },
    {
      lead: 'Turning it off',
      text: `Switch iCloud Sync off at any time; the files on ${here} stay put. To delete the copies in iCloud, use Remove synced files from iCloud.`,
    },
  ]
}

/** Remove confirmation (FR-33). */
export const REMOVE_TITLE = 'Remove synced files from iCloud?'
export const REMOVE_INTRO = 'These files will be deleted from your iCloud account:'

/**
 * icloud-bar-chart-sync (FR-13): the county files as ONE counted line in the
 * Remove confirmation's list (the state holds codes, not names, and the set
 * has no quota, so it is counted rather than listed; the count is live UI
 * state, never published prose). The subject takes the singular at one.
 */
export function removeCountiesLine(n: number): string {
  return n === 1 ? 'The bar-chart file for 1 county' : `Bar-chart files for ${counted(n, 'county', 'counties')}`
}
/** The day answers' line in the same list, when iCloud holds any device's copy. */
export const REMOVE_DAY_OBS_LINE = "The Targets tab's saved day-by-day eBird answers"
export function removeOutro(here: string): string {
  return `The copies on ${here} and on your other devices are not touched. To keep iCloud empty, turn iCloud Sync off on each device first: a device with sync on uploads its copy again at its next check.`
}

/** Clear with sync on (FR-30). */
export function clearTitle(rowTitle: string): string {
  return `Clear ${rowTitle}?`
}
export function clearBody(here: string): string {
  return ` will be removed from ${here} and from iCloud. Every Mac, iPhone and iPad with iCloud Sync on removes its copy at its next check. Devices with sync off keep theirs.`
}

// ── icloud-api-key-sync (design-spec.md Content Notes; the complete new set) ──

/** The key switch row (FR-01, FR-02). */
export const KEY_SWITCH_LABEL = 'Sync API keys'
export const KEY_SWITCH_DESCRIPTION =
  'Keeps your eBird and OpenWeather keys the same on every Mac, iPhone and iPad that also turns this on.'
/** The reason while iCloud is available but the file switch is off. */
export const KEY_SWITCH_REASON_FILE_SYNC_OFF = 'Turn on iCloud Sync first.'

/** The service word for each slot; never a value (FR-21). */
export const KEY_SERVICE_WORD: Record<KeySlot, string> = { ebird: 'eBird', openweather: 'OpenWeather' }
export const KEY_ROW_TITLE: Record<KeySlot, string> = { ebird: 'eBird API Key', openweather: 'OpenWeather API Key' }

/** FR-39: the five key-row states plus Sync off, as text. */
export const KEY_STATE_LABELS: Record<KeySlotState, string> = {
  'up-to-date': 'Up to date',
  syncing: 'Syncing',
  'waiting-to-upload': 'Waiting to upload',
  unavailable: 'iCloud unavailable',
  off: 'Sync off',
  error: 'Could not sync',
}

/** FR-38 provenance: "From this device, changed <time>" / "From <devName>, changed <time>". */
export function fromChangedText(
  fromThisDevice: boolean,
  origin: { label: string; platform: OriginPlatform } | undefined,
  formattedTime: string,
): string {
  return `${fromText(fromThisDevice, origin)}, changed ${formattedTime}`
}

/** FR-41 line; takes the place of the provenance while set. */
export function keyReplacedText(origin: { label: string; platform: OriginPlatform } | undefined, formattedTime: string): string {
  const who = origin ? devName(origin) : 'another device'
  return `Replaced by the key from ${who}, changed ${formattedTime}`
}

/** FR-42 line, on a row that holds no key. */
export function keyClearedText(origin: { label: string; platform: OriginPlatform } | undefined, formattedTime: string): string {
  const who = origin ? devName(origin) : 'another device'
  return `Cleared from ${who}, ${formattedTime}`
}

/** FR-30 sentence, under Waiting to upload while a Clear has not reached iCloud. */
export const CLEAR_PENDING_TEXT = 'This clear has not reached iCloud yet.'

/**
 * Key reasons (closed table, one sentence, never a value): 'key-shape' and
 * 'key-time' (the two write-chokepoint refusals; the second added in the
 * security fix round, Finding 1) plus the native codes.
 */
export type KeyReasonCode = ICloudError | 'key-shape' | 'key-time'
export const KEY_REASONS: Record<'key-shape' | 'key-time' | 'timeout' | 'unknown', string> = {
  'key-shape': 'This key has characters iCloud sync cannot carry.',
  'key-time': 'The date and time on this device are too far off to sync this key.',
  timeout: 'iCloud did not respond in time.',
  unknown: 'iCloud could not be read.',
}
export function keyReasonFor(code: KeyReasonCode): string {
  if (code === 'key-shape') return KEY_REASONS['key-shape']
  if (code === 'key-time') return KEY_REASONS['key-time']
  if (code === 'timeout') return KEY_REASONS.timeout
  return KEY_REASONS.unknown
}

/** FR-33: the pending line under Remove synced keys from iCloud. */
export const KEY_REMOVAL_PENDING_TEXT =
  'Waiting to remove the key copy from iCloud. SnowRaven will try again when iCloud is reachable.'

/** The enable note for keys (FR-04): six required elements, then one closing line. */
export const ENABLE_KEYS_TITLE = 'Turn on API key sync'
export function enableKeysNoteItems(here: string): { lead: string; text: string }[] {
  return [
    {
      lead: 'What goes to iCloud',
      text: `Your eBird key and your OpenWeather key, exactly as you entered them, and for each one when it was last changed and which device changed it (its name and kind). Settings and caches stay on ${here}.`,
    },
    {
      lead: 'Whose account',
      text: "Your own iCloud account, on Apple's servers, in the same private SnowRaven folder as your synced files. SnowRaven has no server of its own, so the keys never pass through one, and the developer cannot see them.",
    },
    {
      lead: 'How Apple protects it',
      text: "Apple encrypts the keys in transit and at rest. They are end-to-end encrypted only if Advanced Data Protection is turned on for your iCloud account; without it, Apple's standard iCloud protection applies, the same as for your synced files.",
    },
    {
      lead: 'Which devices',
      text: 'Every Mac, iPhone and iPad signed in to this iCloud account that also turns on Sync API keys. A device with the switch off keeps its own keys and receives nothing.',
    },
    {
      lead: 'What happens next',
      text: 'A device with no key takes the shared one. When two devices hold different keys, the most recently changed key wins. Clearing a key on any sharing device clears it on the others at their next check.',
    },
    {
      lead: 'How to stop',
      text: `Switch Sync API keys off at any time: the keys on ${here} stay put and the copy in iCloud is removed. Remove synced keys from iCloud is also available whenever iCloud holds a copy.`,
    },
  ]
}
export const ENABLE_KEYS_FINE = 'Nothing is written to iCloud until you choose Turn on.'

/** Clear with key sync on (FR-28). */
export function keyClearTitle(slot: KeySlot): string {
  return `Clear ${KEY_ROW_TITLE[slot]}?`
}
export function keyClearBody(slot: KeySlot, here: string): string {
  return `Your ${KEY_SERVICE_WORD[slot]} key will be removed from ${here}, from iCloud, and from every device sharing keys at its next check. Devices with Sync API keys off keep theirs.`
}

/** Remove synced keys from iCloud (FR-34, FR-35). */
export const REMOVE_KEYS_TITLE = 'Remove synced keys from iCloud?'
export function removeKeysBody(here: string): string {
  return `Your eBird key and your OpenWeather key will be deleted from your iCloud account. The keys on ${here} and on your other devices are not touched.`
}
export const REMOVE_KEYS_OUTRO =
  'To keep iCloud empty, turn Sync API keys off on each device first: a device with key sync on uploads its keys again at its next check.'

// ── icloud-bar-chart-sync (design-spec.md Copy table, items 5 to 7 and 12 to
// 23, approved 2026-09-28). `here` is `hereWord(platform)`; `county` is always
// "Name, ST". Every count renders through `counted()` and every subject takes
// the singular at exactly one; these builders are the only place such a string
// is composed, so the copy sweeps see all of them. ──

/** The Targets tab's Remove with sync on (items 5 and 6); the confirm button is BUTTONS.removeAllSynced (item 7). */
export function removeCountyTitle(county: string): string {
  return `Remove the bar-chart file for ${county}?`
}
export function removeCountyBody(county: string, here: string): string {
  return `The file for ${county} will be removed from ${here} and from iCloud. Every Mac, iPhone and iPad with iCloud Sync on removes its copy at its next check. Devices with sync off keep theirs.`
}

/** Settings: the Bar-chart files section (items 12, 13 and 17). */
export const BAR_CHART_FILES_HEADER = 'Bar-chart files'
export const BAR_CHART_FILES_DESCRIPTION = 'County bar-chart files added on the Targets tab, for sorting by eBird frequency.'
export const REMOVE_ALL_BAR_CHARTS = 'Remove all bar-chart files'

/** The status line beside the button, and the button's description (items 14 to 16). */
export function barChartsSavedText(n: number, here: string): string {
  return `Saved for ${counted(n, 'county', 'counties')} on ${here}.`
}
export function barChartsNoneText(here: string): string {
  return `No bar-chart files are saved on ${here}.`
}
export function barChartsUnknownText(here: string): string {
  return `Couldn't check for bar-chart files on ${here}.`
}

/** The confirmation (items 18 to 21); with sync on the confirm button is BUTTONS.removeAllSynced. */
export const REMOVE_ALL_BAR_CHARTS_TITLE = 'Remove all bar-chart files?'
export const REMOVE_ALL_CONFIRM = 'Remove all'
export function removeAllBarChartsBody(n: number, here: string, syncOn: boolean): string {
  const subject = n === 1 ? 'The bar-chart file for 1 county' : `Bar-chart files for ${counted(n, 'county', 'counties')}`
  const where = syncOn ? `${here} and from iCloud` : here
  const others = syncOn
    ? ' Every Mac, iPhone and iPad with iCloud Sync on removes its copies at its next check. Devices with sync off keep theirs.'
    : ''
  return `${subject} will be removed from ${where}.${others} Your eBird backup, ML export and API keys are not touched.`
}

/** After a partial failure, role="alert" (item 22). */
export function removeAllPartialText(k: number, here: string): string {
  return k === 1
    ? `The bar-chart file for 1 county could not be removed and remains on ${here}. Try again.`
    : `Bar-chart files for ${counted(k, 'county', 'counties')} could not be removed and remain on ${here}. Try again.`
}

/** After a successful removal, polite role="status", once (item 23). */
export function removeAllDoneText(n: number): string {
  return n === 1 ? 'Removed the bar-chart file for 1 county.' : `Removed bar-chart files for ${counted(n, 'county', 'counties')}.`
}
