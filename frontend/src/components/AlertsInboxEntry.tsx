// Two of the Alerts inbox's entry points (ios-alerts design-spec 7.2, the
// revision after the live look): the iPhone header bell and the iPad sidebar
// item. ENTRY-SAFE: the App shell and the nav column are on the entry chunk, so
// these read the gate and the count from the entry-safe store
// (lib/alerts/alertsInboxEntry.ts) and open the lazy App-root sheet through the
// opener App installs. Neither imports the sheet, the copy module or the
// controller.
//
// ABSENT, NEVER HIDDEN: each renders `null` while the gate is false (alerts off
// and the inbox empty, or not iPhone/iPad), so no inbox control exists to find.
// The count badge and pill are `aria-hidden`; the count is read in the
// control's own name ("Alerts inbox, 3 new") when it is reached, never
// announced live.

import { useRef } from 'react'
import { Bell } from 'lucide-react'
import { Button } from './ui/Button'
import {
  badgeText, INBOX_ENTRY_LABEL, inboxEntryName, openAlertsInbox, useInboxEntry,
} from '../lib/alerts/alertsInboxEntry'

/** The bell at the trailing edge of the phone header. Rendered INSIDE the
 *  phone `<header>`, so it inherits `chromeInert` under the fullscreen map. */
export function AlertsInboxBell() {
  const { visible, count } = useInboxEntry()
  const ref = useRef<HTMLButtonElement>(null)
  if (!visible) return null
  return (
    <Button
      ref={ref}
      type="button"
      className="sr-hdr-inbox"
      aria-haspopup="dialog"
      aria-label={inboxEntryName(count)}
      onClick={() => openAlertsInbox({ trigger: () => ref.current })}
    >
      <Bell size={18} strokeWidth={2.1} className="sr-hdr-inbox-glyph" aria-hidden="true" />
      {count > 0 && <span className="sr-badge" aria-hidden="true">{badgeText(count)}</span>}
    </Button>
  )
}

interface NavItemProps {
  /** The glyph preset of the density (TabNav's NAV_ICON). */
  glyph: { size: number; strokeWidth: number }
  /** The rail tooltip's hover / focus / touch-hold handlers (TabNav). */
  tipHandlers?: React.HTMLAttributes<HTMLButtonElement>
}

/** The nav column's "Alerts inbox" item, under Search and above the
 *  destinations. A plain button in the `.sr-nav-item` register: NOT a
 *  `role="tab"`, and not in the saved tab order. At rail density the column's
 *  own CSS hides the label, so the item is icon-only and named by its
 *  `aria-label` and the rail tooltip, exactly like a destination. */
export function AlertsInboxNavItem({ glyph, tipHandlers }: NavItemProps) {
  const { visible, count } = useInboxEntry()
  const ref = useRef<HTMLButtonElement>(null)
  if (!visible) return null
  return (
    <Button
      ref={ref}
      type="button"
      className="sr-nav-item sr-nav-inbox"
      aria-haspopup="dialog"
      aria-label={inboxEntryName(count)}
      onClick={() => openAlertsInbox({ trigger: () => ref.current })}
      {...tipHandlers}
    >
      <Bell size={glyph.size} strokeWidth={glyph.strokeWidth} aria-hidden="true" />
      <span>{INBOX_ENTRY_LABEL}</span>
      {count > 0 && <span className="sr-nav-count" aria-hidden="true">{badgeText(count)}</span>}
    </Button>
  )
}
