// The ONE authoritative glyph per destination (feature: nav-rework).
//
// WHY IT MOVED OUT OF App.tsx. The nav now draws the same eleven glyphs at three
// nav scales -- 15px/2.25 in the sidebar, 17px/2.1 in the More sheet, 18px/2 in
// the icon rail, 20px/2 in the phone bottom bar -- so a table of pre-rendered
// React nodes baked at 14px could not serve it. The entries are RENDER FUNCTIONS
// taking the size and stroke, which is what keeps "one table" true across the
// densities instead of one table per density.
//
// `.claude/rules/ui.md` records lucide icons at 11-15px in content. The rail and
// bar sizes are a deliberate nav-scale extension of that range, logged as
// deviation 3 in the design refinement: at those densities the icon is doing
// identification work rather than decorating a label.
//
// Multimedia's glyph is lucide `Images` (deviation 4, approved by the user at the
// design gate). It was `List`, which at 18px in the rail is indistinguishable
// from Checklists' `ClipboardList` -- and a rail cannot work with two identical
// glyphs. TAB_LABELS is untouched: the destination is still named Multimedia.
//
// Every glyph is `aria-hidden`. The accessible name comes from the row's own text
// at the labelled densities and from an explicit `aria-label` in the rail, so an
// announced icon would only ever double it.
//
// Entry-chunk safety: this file imports `react` types and `lucide-react` only,
// both of which App.tsx already carries. entryChunk.test.ts is the live guard.

import { BookOpen, BarChart2, Images, Dna, Tag, ClipboardList, CalendarDays } from 'lucide-react'
import type { Tab } from './tabLayout'

export interface TabIconProps {
  size: number
  strokeWidth: number
}

export type TabIcon = (props: TabIconProps) => React.ReactElement

/** The shared attributes of the four hand-drawn glyphs (no lucide equivalent fits). */
function svgProps(size: number, strokeWidth: number) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  }
}

export const TAB_ICONS: Record<Tab, TabIcon> = {
  'weather': ({ size, strokeWidth }) => (
    <svg {...svgProps(size, strokeWidth)}>
      <path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z" />
    </svg>
  ),
  'species-detail': ({ size, strokeWidth }) => (
    <BookOpen size={size} strokeWidth={strokeWidth} aria-hidden="true" />
  ),
  'birding-stats': ({ size, strokeWidth }) => (
    <BarChart2 size={size} strokeWidth={strokeWidth} aria-hidden="true" />
  ),
  'map-explorer': ({ size, strokeWidth }) => (
    <svg {...svgProps(size, strokeWidth)}>
      <polygon points="3 6 9 3 15 6 21 3 21 18 15 21 9 18 3 21" />
      <line x1="9" y1="3" x2="9" y2="18" />
      <line x1="15" y1="6" x2="15" y2="21" />
    </svg>
  ),
  // Multimedia. `Images`, not `List` — see the header.
  'life-list': ({ size, strokeWidth }) => (
    <Images size={size} strokeWidth={strokeWidth} aria-hidden="true" />
  ),
  'breeding-codes': ({ size, strokeWidth }) => (
    <Dna size={size} strokeWidth={strokeWidth} aria-hidden="true" />
  ),
  'named-birds': ({ size, strokeWidth }) => (
    <Tag size={size} strokeWidth={strokeWidth} aria-hidden="true" />
  ),
  'checklists': ({ size, strokeWidth }) => (
    <ClipboardList size={size} strokeWidth={strokeWidth} aria-hidden="true" />
  ),
  'calendar': ({ size, strokeWidth }) => (
    <CalendarDays size={size} strokeWidth={strokeWidth} aria-hidden="true" />
  ),
  'comparer': ({ size, strokeWidth }) => (
    <svg {...svgProps(size, strokeWidth)}>
      <path d="M21 6H3" /><path d="M10 12H3" /><path d="M10 18H3" />
      <polyline points="15 12 18 15 21 12" /><path d="M18 6v9" />
    </svg>
  ),
  'settings': ({ size, strokeWidth }) => (
    <svg {...svgProps(size, strokeWidth)}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
}

/** Nav-scale icon sizes, one place, so the three densities cannot drift apart. */
export const NAV_ICON = {
  sidebar: { size: 15, strokeWidth: 2.25 },
  rail:    { size: 18, strokeWidth: 2 },
  sheet:   { size: 17, strokeWidth: 2.1 },
  bar:     { size: 20, strokeWidth: 2 },
} as const
