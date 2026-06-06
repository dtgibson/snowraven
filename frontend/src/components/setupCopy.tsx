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
  <>Click <strong>Save Spreadsheet</strong> — don't rename the downloaded file</>,
  <>Upload it in <strong>Settings → Default Files → ML Export</strong></>,
]
