import type { ReactNode } from 'react'

// Single source of truth for the data-file setup steps shown by every SetupRequired
// screen. Previously each tab hand-rolled its own steps, which drifted (only one
// mentioned the .zip; the Multimedia tab omitted the critical ML "filter = All"
// step). Keep these accurate and let all tabs share them.

const codeStyle = {
  fontFamily: 'ui-monospace, monospace',
  fontSize: '0.75rem',
  background: 'var(--sr-border)',
  padding: '1px 5px',
  borderRadius: 3,
} as const

/** How to obtain + install the eBird backup (`MyEBirdData.csv`). */
export const EBIRD_BACKUP_STEPS: ReactNode[] = [
  <>Go to <strong>ebird.org</strong> → My eBird → <strong>Download My Data</strong></>,
  <>Save the download, and if it's a <code style={codeStyle}>.zip</code> unzip it to get <code style={codeStyle}>MyEBirdData.csv</code></>,
  <>Upload that file in <strong>Settings → Default Files → eBird Backup</strong></>,
  <>This tab then loads automatically on every visit</>,
]

/** How to obtain + install the Macaulay Library export. Step 2 is the one users miss. */
export const ML_EXPORT_STEPS: ReactNode[] = [
  <>Go to <strong>macaulaylibrary.org</strong> → <strong>My Media</strong></>,
  <>Set the media-type filter to <strong>All</strong> (not just Birds) so every item is included</>,
  <>Click <strong>Save Spreadsheet</strong>; don't rename the downloaded file</>,
  <>Upload it in <strong>Settings → Default Files → ML Export</strong></>,
]

// ── Terse load-failure copy ──────────────────────────────────────────────────
// These are the `error` phase's messages, NOT the `setup-required` panel's. The
// two phases are deliberately distinct (DECISIONS.md, 2026-05-22): `setup-required`
// means "go configure this in Settings first" and shows the SetupRequired guidance
// component with the steps above; `error` means "a file IS stored and it would not
// load" and shows a terse message with a Go to Settings button. Do not put the
// steps arrays into an error message; do name the file and the Settings path, the
// way BreedingCodeList's wrong-file branch already does, so the message is honest
// AND useful. Single-sourced because nine surfaces carry the eBird one and they
// drifted before (two spellings in ListComparer alone).

/** A stored eBird backup that could not be read or parsed. */
export const EBIRD_BACKUP_LOAD_ERROR =
  "Couldn't load your eBird backup. Re-upload MyEBirdData.csv in Settings → Default Files → eBird Backup."

/** A stored Macaulay Library export that could not be read or parsed. Named by its Settings
 * slot rather than a filename: the download's name varies (it carries the user's
 * ML user id) and ML_EXPORT_STEPS tells them not to rename it. */
export const ML_EXPORT_LOAD_ERROR =
  "Couldn't load your Macaulay Library export. Re-upload it in Settings → Default Files → ML Export."
