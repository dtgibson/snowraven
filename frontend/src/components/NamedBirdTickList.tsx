// The one selectable sighting strip, shared by BOTH Named Birds timelines: the
// per-bird strip inside an expanded card, and the strip at the bottom of the tab
// with a lane per named bird. The hit test, the key handling, the readout
// contract and the ARIA wiring therefore exist in exactly one module; the master
// differs only by having `role="group"` lanes and the Up/Down key map.
//
// THE TRACK IS THE CONTROL, NOT THE MARK. Marks carry `pointer-events: none`,
// no `tabIndex`, no anchor and no per-mark click, hover or focus handler. The
// track takes the press and a press selects the NEAREST sighting by horizontal
// position, which partitions the full width so every sighting owns a non-zero
// slice and overlap becomes irrelevant to hit testing. That is what lets marks
// overlap and coincide freely: at 320px a bird with six dates inside eight days
// is six marks inside about six pixels, and a 3px mark cannot be made a target
// without spacing, jitter or binning, all of which would falsify the picture.
//
// EXACTLY ONE TAB STOP PER STRIP, AND THE COUNT IS INVARIANT in the number of
// birds and the number of sightings. That invariance is the property that made
// selectable marks acceptable, so it is a requirement in its own right rather
// than a consequence: the strip is a `role="listbox"` whose options are the
// marks, driven by `aria-activedescendant` (the shipped `SpeciesCombobox`
// pattern) rather than by roving tabindex. Population size is the reason: at 200
// birds averaging 100 sightings, roving would put a `tabIndex` and a focus
// handler on up to 20,000 elements. With activedescendant the marks are
// `<div role="option">` with none of that, so they sit outside
// `lib/tabOrderCoverage.test.ts`'s counted population BY ELEMENT TYPE — the same
// ground that roster gives for SnowMap's Trails `<input>` — and that guard gains
// no row. If a later change makes a mark a `<button>`, it goes red, which is the
// right alarm.
//
// NO `aria-live`, NO `role="status"`, NO `role="alert"` ANYWHERE IN THIS FEATURE,
// and this is the statement so a later reader does not restore one as an
// oversight. Two independent reasons. The state change the user makes is the
// range switch, and its own `aria-pressed` announces it; a live region over a
// caption or a legend announces reference material as an event (the shipped
// v1.0.5 rule in `.claude/rules/ui.md`). And the focused option already announces
// its whole payload on every arrow press, so a live region over the readout would
// double-speak — which is also why the readout carries `aria-hidden`.

import { useId, useRef, useState } from 'react'
import { formatDate } from '../lib/formatDate'
import { laneSpan, type TimelineAxis, type TimelineLane, type TimelineMark } from '../lib/namedBirdTimeline'
import { laneGroup, optionName, readLine1, readLine2 } from '../lib/namedBirdTimelineCopy'

/** A committed or previewed mark, keyed by BIRD PLUS DATE — never by position or
 *  index, so it survives a range flip and a Sort change with only the axis
 *  moving under it. */
interface TickSelection {
  lane: string
  date: string
}

export function NamedBirdTickList({
  variant, ariaLabel, lanes, axis, restLine, caption, showSpecies = false,
}: {
  /** `card` is the single-lane strip in an expanded card; `master` is the
   *  many-lane strip at the bottom of the tab. */
  variant: 'card' | 'master'
  /** The listbox's own accessible name. */
  ariaLabel: string
  /** Lanes in DISPLAY ORDER — the caller has already sorted them, so lane order
   *  equals card order under whichever Sort option is selected. */
  lanes: TimelineLane[]
  axis: TimelineAxis
  /** Line 1 of the readout before anything is selected. */
  restLine: string
  /** Master only: the caption INSIDE the listbox. It is `aria-hidden`, because
   *  the sentence above the listbox carries the same facts to the accessibility
   *  tree and announcing both would say them twice. */
  caption?: string
  /** Master only: whether a lane names its species beside the individual. */
  showSpecies?: boolean
}) {
  const uid = useId()
  const rootRef = useRef<HTMLDivElement>(null)
  const [sel, setSel] = useState<TickSelection | null>(null)
  const [hover, setHover] = useState<TickSelection | null>(null)

  /**
   * A DOM id for one option, keyed on POSITION and never on file content.
   *
   * The date came from the user's CSV, and interpolating it here produced ids
   * containing WHITESPACE on 3 of 7 hostile probes. There was no injection --
   * React escapes the attribute and nothing in the app resolves these through a
   * selector, an href or `getElementById` -- but an id with a space in it cannot
   * resolve as an IDREF, which silently switches off the `aria-activedescendant`
   * announcement `ACCESSIBILITY.md` publishes a claim about. A control that
   * quietly stops being announced is the worst shape for an accessibility
   * regression: nothing throws and nothing looks wrong.
   *
   * Both shipped listboxes in this app already key their option ids on an index
   * (`SpeciesCombobox`, which this file cites as its pattern, and
   * `CommandPalette`); this line was the one place that departed from it.
   *
   * THE SELECTION IS STILL KEYED BY BIRD PLUS DATE, and that is a different
   * thing from the id. The id is a rendering detail recomputed from the current
   * render's lanes; the selection is data, and keying it by position is exactly
   * what would break its survival across a range flip and a re-sort. Do not
   * "simplify" one into the other.
   *
   * `uid` is this component instance's `useId()`, so the card strip and the
   * strip at the bottom of the tab cannot collide while both are on the page.
   */
  const optionId = (laneIdx: number, markIdx: number) => `${uid}-o${laneIdx}-m${markIdx}`

  /** Where the readout and the `is-on` styling read from: a hover PREVIEWS,
   *  a press or a key COMMITS. */
  const shown = hover ?? sel
  const shownLaneIdx = shown ? lanes.findIndex(l => l.key === shown.lane) : -1

  // `aria-activedescendant` follows the COMMITTED selection only, and is absent
  // with nothing committed. A mouse-hover preview must never move a screen
  // reader's cursor onto something the user is not pointing at.
  const selLaneIdx = sel ? lanes.findIndex(l => l.key === sel.lane) : -1
  const selMarkIdx = selLaneIdx >= 0 ? lanes[selLaneIdx].marks.findIndex(m => m.date === sel!.date) : -1
  const activeId = selMarkIdx >= 0 ? optionId(selLaneIdx, selMarkIdx) : undefined

  const commit = (laneIdx: number, mark: TimelineMark | undefined) => {
    if (!mark || !lanes[laneIdx]) return
    setSel({ lane: lanes[laneIdx].key, date: mark.date })
    setHover(null)
  }

  /** The rail element of one lane, or of the lane a pointer event landed in. */
  const railFor = (laneIdx: number): HTMLElement | null =>
    rootRef.current?.querySelector<HTMLElement>(`[data-nbt-lane="${laneIdx}"] .sr-nbt-rail`) ?? null

  /**
   * Nearest sighting by horizontal position within one lane. Every sighting owns
   * a slice of the width and no slice is zero, so no press can fail to select
   * and no part of the track is unreachable.
   */
  const hit = (laneIdx: number, clientX: number): TimelineMark | undefined => {
    const lane = lanes[laneIdx]
    const rail = railFor(laneIdx)
    if (!lane || !rail || lane.marks.length === 0) return undefined
    const r = rail.getBoundingClientRect()
    const p = r.width > 0 ? ((clientX - r.left) / r.width) * 100 : 0
    let best = lane.marks[0]
    let bestD = Math.abs(best.pct - p)
    for (const m of lane.marks) {
      const d = Math.abs(m.pct - p)
      if (d < bestD) { bestD = d; best = m }
    }
    return best
  }

  /** Which lane a pointer event landed in. A press on the master's caption or on
   *  its axis-date row belongs to no lane, and resolves to the lane the reader is
   *  already in, else the first. */
  const laneIdxAt = (target: EventTarget | null): number => {
    const el = target instanceof Element ? target.closest('[data-nbt-lane]') : null
    const attr = el?.getAttribute('data-nbt-lane')
    if (attr !== null && attr !== undefined) {
      const n = Number(attr)
      if (Number.isInteger(n) && n >= 0 && n < lanes.length) return n
    }
    return shownLaneIdx >= 0 ? shownLaneIdx : 0
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    // Enter and Space are deliberately UNBOUND: there is nothing to activate,
    // selection is the whole interaction, and the readout is never a link.
    const laneIdx = selLaneIdx >= 0 ? selLaneIdx : 0
    const marks = lanes[laneIdx]?.marks ?? []
    if (marks.length === 0) return
    const i = sel ? marks.findIndex(m => m.date === sel.date) : -1

    switch (e.key) {
      case 'ArrowRight':
        e.preventDefault()
        commit(laneIdx, marks[Math.min(i + 1, marks.length - 1)])
        return
      case 'ArrowLeft':
        e.preventDefault()
        commit(laneIdx, marks[Math.max(i - 1, 0)])
        return
      case 'Home':
        e.preventDefault()
        commit(laneIdx, marks[0])
        return
      case 'End':
        e.preventDefault()
        commit(laneIdx, marks[marks.length - 1])
        return
      case 'ArrowUp':
      case 'ArrowDown': {
        // Master only, and structurally so: a card strip holds one lane.
        if (lanes.length < 2) return
        e.preventDefault()
        const next = e.key === 'ArrowDown'
          ? Math.min(laneIdx + 1, lanes.length - 1)
          : Math.max(laneIdx - 1, 0)
        const target = lanes[next].marks
        if (target.length === 0) return
        // Land on the sighting nearest in DATE to the current one. Every lane is
        // positioned against the same axis, so position is a monotone function
        // of date and nearest-by-position IS nearest-by-date.
        const here = i >= 0 ? marks[i].pct : 0
        let best = target[0]
        let bestD = Math.abs(best.pct - here)
        for (const m of target) {
          const d = Math.abs(m.pct - here)
          if (d < bestD) { bestD = d; best = m }
        }
        commit(next, best)
        return
      }
      case 'Escape':
        // Consumed ONLY while something is selected, so with nothing selected the
        // press still reaches an outer Escape layer — the shipped SpeciesCombobox
        // rule, innermost dismiss layer first.
        if (sel) {
          e.stopPropagation()
          setSel(null)
          setHover(null)
        }
        return
      default:
        return
    }
  }

  const readout = (() => {
    if (!shown || shownLaneIdx < 0) return { rest: true, l1: restLine, l2: '' }
    const lane = lanes[shownLaneIdx]
    const i = lane.marks.findIndex(m => m.date === shown.date)
    if (i < 0) return { rest: true, l1: restLine, l2: '' }
    return {
      rest: false,
      l1: readLine1(variant === 'master' ? lane.name : '', lane.marks[i].date, lane.marks[i].places),
      l2: readLine2(i + 1, lane.marks.length),
    }
  })()

  const rail = (lane: TimelineLane, laneIdx: number) => {
    const span = laneSpan(lane.marks)
    return (
      <div className="sr-nbt-rail">
        {span && (
          <span
            className="sr-nbt-span"
            style={{ left: `${span.from.toFixed(3)}%`, right: `${(100 - span.to).toFixed(3)}%` }}
          />
        )}
        {lane.marks.map((m, i) => {
          const on = !!shown && shown.lane === lane.key && shown.date === m.date
          return (
            <div
              key={m.date}
              id={optionId(laneIdx, i)}
              role="option"
              aria-selected={on}
              aria-posinset={i + 1}
              aria-setsize={lane.marks.length}
              // THE WHOLE PAYLOAD, so a screen-reader user never needs the
              // visible readout — and no position words, because
              // aria-posinset/aria-setsize already carry that and saying it in
              // the name too makes the screen reader repeat it.
              aria-label={optionName(variant === 'master' ? lane.name : '', m.date, m.places)}
              className={on ? 'sr-nbt-tick is-on' : 'sr-nbt-tick'}
              style={{ left: `${m.pct.toFixed(3)}%` }}
            />
          )
        })}
      </div>
    )
  }

  const listboxProps = {
    ref: rootRef,
    role: 'listbox' as const,
    tabIndex: 0,
    'aria-label': ariaLabel,
    'aria-activedescendant': activeId,
    onKeyDown,
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => {
      const laneIdx = laneIdxAt(e.target)
      commit(laneIdx, hit(laneIdx, e.clientX))
      // Move DOM focus to the track so the arrow keys carry on from here. There
      // is no hover on iOS, which is exactly why commit is on press.
      e.currentTarget.focus()
    },
    onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.pointerType !== 'mouse') return          // there is no hover on touch
      const laneIdx = laneIdxAt(e.target)
      const mark = hit(laneIdx, e.clientX)
      if (!mark) return
      if (e.buttons === 1) commit(laneIdx, mark)     // held press scrubs and commits
      else setHover({ lane: lanes[laneIdx].key, date: mark.date })
    },
    onPointerLeave: () => setHover(null),
    onBlur: () => { setSel(null); setHover(null) },
  }

  const ends = (
    <div className="sr-nbt-ends">
      <span>{formatDate(axis.start)}</span>
      <span>{formatDate(axis.end)}</span>
    </div>
  )

  const readoutEl = (
    // Rendered from first paint and never unmounted or hidden, so nothing shifts
    // when it fills (the shipped SyncLine rule). It is text, so it lives OUTSIDE
    // every fixed-px box. `aria-hidden` because the focused option announces the
    // same words. It is never a link in any state.
    <p className={readout.rest ? 'sr-nbt-readout is-rest' : 'sr-nbt-readout'} aria-hidden="true">
      <span className="l1">{readout.l1}</span>
      <span className="l2">{readout.l2}</span>
    </p>
  )

  if (variant === 'card') {
    const lane = lanes[0]
    if (!lane) return null
    return (
      <>
        <div {...listboxProps} className="sr-nbt-track sr-nbt-lb" data-nbt-lane="0">
          {rail(lane, 0)}
        </div>
        {ends}
        {readoutEl}
      </>
    )
  }

  return (
    <>
      <div {...listboxProps} className="sr-nbt-mplot sr-nbt-lb">
        {caption && <span className="sr-nbt-cap" aria-hidden="true">{caption}</span>}
        {lanes.map((lane, laneIdx) => (
          <div
            key={lane.key}
            className={shownLaneIdx === laneIdx ? 'sr-nbt-lane is-on' : 'sr-nbt-lane'}
            role="group"
            aria-label={laneGroup(lane.name, showSpecies ? lane.commonName : '')}
            data-nbt-lane={laneIdx}
          >
            {/* aria-hidden: the lane group's own name already carries these
                words, and duplicating them reads the bird's name twice. It is
                deliberately a plain span rather than <BirdName>, which emits an
                anchor — an anchor here would join the tab-order guard's counted
                <a href> population inside a listbox that is operated by arrow
                keys. */}
            <div className="sr-nbt-lanelabel" aria-hidden="true">
              {lane.name}
              {showSpecies && <i>{lane.commonName}</i>}
            </div>
            <div className="sr-nbt-lanetrack">{rail(lane, laneIdx)}</div>
          </div>
        ))}
        <div className="sr-nbt-lane sr-nbt-mends" aria-hidden="true">
          {/* The empty label cell that lines the axis dates up with the lane
              tracks above. It carries a class of its own rather than being
              reached by `> :first-child`: a positional selector's rightmost
              compound is universal, so it competes for `display` with every
              first child in the bundle, which is exactly what the shipped
              cascade-competitor scan in `mapFabCascade.test.ts` rejects. */}
          <div className="sr-nbt-mendspacer" />
          {ends}
        </div>
      </div>
      {readoutEl}
    </>
  )
}
