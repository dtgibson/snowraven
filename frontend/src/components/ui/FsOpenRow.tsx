// The opener row under a phone-tier still (map-scroll-on-phones D-09): one
// full-width accent button and one helper line, the same register for the maps
// and the Family Tree's tree. It sits AFTER the host container, outside the box
// that expands, so it is behind the panel while the map is open and outside the
// trap, which is what gives focus somewhere to come back to.
//
// ENTRY-SAFE. NamedBirdRow.tsx and WeatherForecastPanel.tsx are on App.tsx's
// static graph and render this, so it imports `react`, the Button primitive and
// one lucide glyph, and nothing map-side ever (mapFullscreenEntrySafe.test.ts).
//
// It renders nothing unless `fs.stillTier`, so above the phone tier the page is
// HEAD's. While the map is expanded it STAYS rendered (the tier has not changed),
// which is deliberate: a row that left the layout on open would move the page
// behind the panel and leave the exit effect nothing to land on.

import { useId } from 'react'
import { Maximize2 } from 'lucide-react'
import { Button } from './Button'

/** What the row needs from its host: the hook's own members, or a host's own
 *  state shaped the same way (the Map Explorer, which opens the tab's own
 *  fullscreen and does not use the hook). */
export interface FsOpenRowHost {
  stillTier: boolean
  open: () => void
  registerOpener: (el: HTMLButtonElement | null) => void
}

export function FsOpenRow({ fs, label, note, noteHidden = false, inset = false }: {
  fs: FsOpenRowHost
  /** The visible label, from lib/mapStillCopy.ts (or the tree's own copy). */
  label: string
  /** One helper line, wired to the button with `aria-describedby`. */
  note: string
  /** Keep the line for assistive tech only (`.sr-only`), as the Map Explorer
   *  does inside its fixed-height panel. */
  noteHidden?: boolean
  /** The host's map runs edge to edge in its card (Species Detail, Hotspot
   *  Reports), so the row takes a side gutter of its own (`--inset`). */
  inset?: boolean
}) {
  const noteId = useId()
  // Destructured so `ref=` receives a local, never a member of `fs`: a member
  // expression passed to `ref` makes the compiler treat the whole object as a
  // ref value (`react-hooks/refs`, ui.md v1.0.15).
  const { stillTier, open, registerOpener } = fs
  if (!stillTier) return null
  return (
    <div className={inset ? 'sr-fs-open-row sr-fs-open-row--inset' : 'sr-fs-open-row'}>
      <Button
        type="button"
        ref={registerOpener}
        className="sr-btn-accent sr-fs-open-btn sr-touch-target"
        aria-describedby={noteId}
        onClick={open}
      >
        <Maximize2 className="sr-fs-open-glyph" size={15} strokeWidth={2.2} aria-hidden />
        <span>{label}</span>
      </Button>
      <p id={noteId} className={noteHidden ? 'sr-fs-open-note sr-only' : 'sr-fs-open-note'}>{note}</p>
    </div>
  )
}
