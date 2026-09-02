// Every user-facing string of the iCloud Sync feature (design-spec.md Content
// Notes, the complete set), in one module so the em-dash and copy sweeps see
// all of it and Settings.tsx stays lean. Pure; no React, no seams.
// No em dash (U+2014) anywhere in this file's strings (repo rule).

import type { OriginPlatform } from './icloudRecord'
import type { Availability, SlotState } from './icloudState'
import type { ICloudError } from './icloudNativeTypes'

export const ICS_HEADER = 'iCloud Sync'
export const ICS_DESCRIPTION =
  'Keeps your eBird backup and ML export the same on every Mac, iPhone and iPad signed in to your iCloud account.'

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
  'too-large': 'The file in iCloud is larger than 200 MB.',
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
  downloadNow: 'Download now',
  retry: 'Retry',
  cancel: 'Cancel',
  turnOn: 'Turn on',
  removeConfirm: 'Remove from iCloud',
  clearConfirm: 'Clear from all synced devices',
} as const

/** Enable note (FR-08): four required elements. */
export const ENABLE_TITLE = 'Turn on iCloud Sync'
export function enableNoteItems(here: string): { lead: string; text: string }[] {
  return [
    {
      lead: 'What goes to iCloud',
      text: `Your eBird backup and your Macaulay Library export, along with each file's name, when it was uploaded, which device it came from (its name), its size and a checksum. Nothing else: your API keys, settings and caches stay on ${here}.`,
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
