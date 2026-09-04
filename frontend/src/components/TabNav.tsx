// The app's main navigation (feature: nav-rework).
//
// ONE responsive nav over the eleven destinations at three densities, replacing
// the horizontal strip that swapped itself for a single all-or-nothing dropdown
// the moment it would overflow (~1,457px with today's labels, which is above most
// real window widths -- so the dropdown was the common case rather than the
// narrow-screen case it was designed as).
//
//   sidebar   13.5rem column, labelled rows           wide windows
//   rail      3.75rem column, icons + tooltips        tight windows, iPad portrait
//   phone     bottom bar of four favourites + More    <= 640px
//
// The three share one row anatomy (icon, label, accent-tinted active fill, a
// leading accent bar) so they read as one component at three sizes.
//
// WHAT DECIDES THE DENSITY lives in lib/navDensity.ts, kept pure and free of the
// DOM. The measurement here supplies it with two numbers and nothing else.
//
// KEYBOARD -- the part that must not be got wrong. The sidebar and the rail are
// the shipped tablist ROTATED: role="tablist" with aria-orientation="vertical",
// role="tab" children keeping their `tab-{id}` / `panel-{id}` wiring, roving
// tabindex, Up/Down instead of Left/Right. That is the app's ONE remaining
// roving-focus group, and lib/tabOrderCoverage.test.ts holds its single exception
// row. EVERYTHING ELSE the nav draws -- the collapse toggle, all five bottom-bar
// cells, every More-sheet row -- is a plain button carrying a LITERAL
// tabIndex={0}, because WebKit's default tab mode (the shipped Mac, iPhone and
// iPad apps) skips an unmarked <button> entirely. The old collapsed dropdown's
// role="option" listbox was the second roving group; it is gone, and the roster
// is one row shorter for it.
//
// TWO STANDING CHECKS, both directly on this path:
//   * The off-screen measurement probe is GONE. The threshold reads the live root
//     font size instead, so the v0.5.37 page-horizontal-scroll hazard cannot
//     recur here. If a probe is ever reintroduced it must sit under a clipped
//     ancestor (.claude/rules/ui.md).
//   * The nav column is a REAL BOX, not a `display: contents` wrapper, so the
//     `inert` for the fullscreen map now sits on the element itself. chromeBoxes
//     in lib/mapPanelChrome.ts keeps its one-level descent regardless -- see the
//     note there.

import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import { MoreHorizontal, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import type { Tab } from '../lib/tabLayout'
import { NAV_ICON, type TabIcon } from '../lib/tabIcons'
import { RavenGlyph } from './RavenGlyph'
import { useFocusTrap } from '../lib/useFocusTrap'
import {
  deriveWideDensity,
  resolveDensity,
  rootFontSizePx,
  type ContentReserve,
  type WideDensity,
} from '../lib/navDensity'

export interface NavItem {
  id: Tab
  label: string
  /** A render function, not a node: the same glyph is drawn at four nav scales. */
  icon: TabIcon
}

export interface TabNavProps {
  /** The user's saved visible order, flat, with Settings appended last. */
  items: NavItem[]
  activeTab: Tab
  onSelect: (tab: Tab) => void
  /** `(max-width: 640px)`, owned by App so it can PLACE the nav by density. */
  isPhone: boolean
  /**
   * The app shell, whose width is `available`. Never the nav's own box.
   *
   * An ELEMENT rather than a ref object, and that is load-bearing rather than a
   * style choice: the shell is an ANCESTOR of this component, and React attaches
   * a parent's ref only AFTER its children's layout effects have run. A ref would
   * therefore read null on the first commit — the measurement skipped and, worse,
   * the ResizeObserver never attached at all, leaving the nav pinned at its
   * initial density for the life of the page. Passing it as state means the
   * effects re-run the moment it exists.
   */
  shell: HTMLElement | null
  /** What the active tab's own in-flow sidebar takes out of the content column. */
  reserve: ContentReserve
  /**
   * Ref CALLBACK for the bottom bar's element, so lib/mapPanelChrome.ts can add
   * its height to the chrome. A callback rather than a ref object because the bar
   * mounts and unmounts with the density, and the consumer has to rebuild a
   * ResizeObserver when it does — which a ref object's silent mutation cannot
   * tell it.
   */
  navBarRef?: (el: HTMLElement | null) => void
  /** True while the fullscreen map overlay is up: the whole nav leaves the tab order. */
  inert?: boolean
}

/** The tagline, moved from under the page wordmark to under the sidebar wordmark. */
const TAGLINE = 'Self-hosted birding tools and data explorer'

/** How many favourites the phone bar shows before the rest go under More. */
const PHONE_FAVOURITES = 4

/** Published on <html> while the bottom bar is mounted; see `useNavBarHeight`. */
const NAV_BAR_HEIGHT_VAR = '--sr-navbar-h'

// ---------------------------------------------------------------------------
// Density derivation
// ---------------------------------------------------------------------------

/**
 * The derived density for a wide window, measured from the SHELL.
 *
 * Two triggers, and between them they cover everything that can move the answer:
 *
 *   * a ResizeObserver on the shell — the window resize, an orientation change,
 *     and (through the shell's HEIGHT, which is content-driven) a font finishing
 *     loading;
 *   * a re-measure after EVERY commit — which is what covers an in-app text-scale
 *     change, whose whole effect is on the root font size and which can leave the
 *     shell's box untouched on a short tab in a tall window. It costs one
 *     `clientWidth` read and one `getComputedStyle` per render of a component
 *     that renders on tab changes, not per frame.
 *
 * It cannot loop. `available` is the shell's width, which the app root sets and
 * which no density change can move; the root font size is not ours either. A
 * change is committed only when the answer actually differs, so the re-measure
 * that follows that commit reads the same two numbers and bails.
 *
 * `reserve` is a real dependency rather than a ref read, so the observer is torn
 * down and rebuilt when the active tab moves onto or off the Map Explorer. That
 * costs one ResizeObserver per tab change and buys a rule this file does not have
 * to keep: nothing is read during render.
 */
function useDerivedDensity(
  shell: HTMLElement | null,
  reserve: ContentReserve,
  onDerivedChange: () => void,
): WideDensity {
  const [derived, setDerived] = useState<WideDensity>('sidebar')
  // The one ref here holds the CURRENT ANSWER, which is what hysteresis is
  // relative to. It is read and written inside the measurement, never during
  // render.
  const derivedRef = useRef<WideDensity>('sidebar')

  const measure = useCallback(() => {
    if (!shell) return
    const rootPx = rootFontSizePx()
    if (rootPx === null) return
    const next = deriveWideDensity({
      availablePx: shell.clientWidth,
      rootFontPx: rootPx,
      reserve,
      previous: derivedRef.current,
    })
    if (next === derivedRef.current) return
    derivedRef.current = next
    // Batched into the same commit as the width change, which is what keeps a
    // DERIVED change instant: the animation class is gone before the new width
    // is painted. See "the width transition runs on the manual toggle only".
    onDerivedChange()
    setDerived(next)
  }, [shell, reserve, onDerivedChange])

  // Before paint, so the correct density shows with no flash (the old TabNav's
  // NFR-03 property, kept).
  useLayoutEffect(measure)

  useLayoutEffect(() => {
    if (typeof ResizeObserver === 'undefined' || !shell) return
    const ro = new ResizeObserver(measure)
    ro.observe(shell)
    return () => ro.disconnect()
  }, [measure, shell])

  return derived
}

// ---------------------------------------------------------------------------
// TabNav
// ---------------------------------------------------------------------------

export function TabNav(props: TabNavProps) {
  const { items, activeTab, onSelect, isPhone, shell, reserve, navBarRef, inert } = props

  // Session-only, deliberately NOT persisted. A stored density can be restored
  // into a window where it is wrong, leaving the user to find a control that
  // undoes a state they do not remember setting — and the tab-layout document is
  // about WHICH destinations and in what order, which is a different kind of
  // fact. Nothing new is stored; the existing document, key, shape, seam and
  // normalizer are untouched.
  const [manuallyCollapsed, setManuallyCollapsed] = useState(false)
  const [animating, setAnimating] = useState(false)

  const stopAnimating = useCallback(() => setAnimating(false), [])
  const derived = useDerivedDensity(shell, reserve, stopAnimating)
  const density = resolveDensity(isPhone, derived, manuallyCollapsed)

  // Belt for the transitionend that never arrives (a width that did not actually
  // change, a transition interrupted by an unmount). Without it a stuck class
  // would let the NEXT window drag animate, which is the reflow storm this
  // guards against on the Map Explorer tab.
  useEffect(() => {
    if (!animating) return
    const t = setTimeout(() => setAnimating(false), 400)
    return () => clearTimeout(t)
  }, [animating])

  const toggleCollapse = useCallback(() => {
    setAnimating(true)
    setManuallyCollapsed(c => !c)
  }, [])

  if (density === 'phone') {
    return (
      <NavBottomBar
        items={items}
        activeTab={activeTab}
        onSelect={onSelect}
        navBarRef={navBarRef}
        inert={inert}
      />
    )
  }

  return (
    <NavColumn
      items={items}
      activeTab={activeTab}
      onSelect={onSelect}
      rail={density === 'rail'}
      animating={animating}
      onAnimationSettled={stopAnimating}
      // Only when the MEASUREMENT says a sidebar fits: in a derived rail there is
      // no room for the control, so there is no control and no state to explain.
      showCollapse={derived === 'sidebar'}
      collapsed={manuallyCollapsed}
      onToggleCollapse={toggleCollapse}
      inert={inert}
    />
  )
}

// ---------------------------------------------------------------------------
// Densities 1 and 2 — the sidebar and the icon rail (one component, one class flip)
// ---------------------------------------------------------------------------

interface NavColumnProps {
  items: NavItem[]
  activeTab: Tab
  onSelect: (tab: Tab) => void
  rail: boolean
  animating: boolean
  onAnimationSettled: () => void
  showCollapse: boolean
  collapsed: boolean
  onToggleCollapse: () => void
  inert?: boolean
}

function NavColumn(props: NavColumnProps) {
  const {
    items, activeTab, onSelect, rail, animating,
    onAnimationSettled, showCollapse, collapsed, onToggleCollapse, inert,
  } = props

  const glyph = rail ? NAV_ICON.rail : NAV_ICON.sidebar
  const tip = useRailTooltip(rail)

  const selectAndFocus = (id: Tab) => {
    onSelect(id)
    document.getElementById(`tab-${id}`)?.focus()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    const idx = items.findIndex(it => it.id === activeTab)
    if (idx === -1) return
    // Rotated with the nav: Up/Down where the strip used Left/Right. Home/End
    // are unchanged, and both still wrap.
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      selectAndFocus(items[(idx + 1) % items.length].id)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      selectAndFocus(items[(idx - 1 + items.length) % items.length].id)
    } else if (e.key === 'Home') {
      e.preventDefault()
      selectAndFocus(items[0].id)
    } else if (e.key === 'End') {
      e.preventDefault()
      selectAndFocus(items[items.length - 1].id)
    }
  }

  const className =
    'sr-nav-col' + (rail ? ' sr-nav-col--rail' : '') + (animating ? ' sr-nav-col--anim' : '')

  return (
    <div
      className={className}
      inert={inert}
      // Gated on target AND property because transitionend BUBBLES: a row's
      // background-color transition reaches this same handler. Same guard shape
      // as the grid-collapse disclosure rule in .claude/rules/ui.md.
      onTransitionEnd={e => {
        if (e.target === e.currentTarget && e.propertyName === 'width') onAnimationSettled()
      }}
    >
      {/* Brand. THE COMPOSITION WIN: it moves out of the page header and into the
          nav, so <main> starts at the top of the window — roughly 150px returned
          to every tab on every wide window. In the rail the wordmark stays in the
          DOM as an .sr-only h1 so the page never loses its h1. */}
      <div className="sr-nav-brand">
        <RavenGlyph size={22} style={{ color: 'var(--sr-accent)' }} />
        {rail
          ? <h1 className="sr-only">SnowRaven</h1>
          : <h1 className="sr-nav-word">Snow<span>Raven</span></h1>}
      </div>
      {rail
        ? <div className="sr-nav-brandgap" />
        : <p className="sr-nav-tagline">{TAGLINE}</p>}

      {/* The <nav> is the navigation landmark; role="tablist" lives on the inner
          div so it does not override the landmark (a node cannot be both). */}
      <nav aria-label="Main navigation" className="sr-nav-list">
        <div
          role="tablist"
          aria-orientation="vertical"
          className="sr-nav-group"
          onKeyDown={onKeyDown}
        >
          {items.map((item, i) => {
            const active = item.id === activeTab
            const Icon = item.icon
            return (
              <Fragment key={item.id}>
                {/* The one separator that is always true. Settings is APPENDED
                    after the saved order and is never part of it, so its position
                    is structural rather than chosen; every other destination is
                    peer to every other, which is what the saved order asserts.
                    aria-hidden keeps the tablist's children all tabs — the
                    mockup drew this rule outside the tablist, which would have
                    put a role="tab" outside its own group. */}
                {item.id === 'settings' && i > 0 && (
                  <hr className="sr-nav-sep" aria-hidden="true" />
                )}
                <button
                  role="tab"
                  id={`tab-${item.id}`}
                  aria-selected={active}
                  aria-controls={`panel-${item.id}`}
                  // Roving: the tablist holds ONE tab stop and Up/Down move
                  // within it. lib/tabOrderCoverage.test.ts rosters this exact
                  // initializer, and it is the app's only remaining roving group.
                  tabIndex={active ? 0 : -1}
                  // In the rail the label is not on screen, so the accessible
                  // name has to come from here. The tooltip is aria-hidden for
                  // exactly this reason: it must not be announced twice.
                  aria-label={rail ? item.label : undefined}
                  className={'sr-nav-item' + (active ? ' sr-nav-item--active' : '')}
                  onClick={() => onSelect(item.id)}
                  {...tip.handlers(item.label)}
                >
                  <Icon size={glyph.size} strokeWidth={glyph.strokeWidth} />
                  <span>{item.label}</span>
                </button>
              </Fragment>
            )
          })}
        </div>
      </nav>

      {/* Deliberate empty space. It is the reclaimed space, and the design
          system's feel is "no clutter"; nothing is invented to fill it. */}
      <div className="sr-nav-spacer" />

      {showCollapse && (
        <button
          tabIndex={0}
          type="button"
          className="sr-nav-collapse"
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          onClick={onToggleCollapse}
        >
          {collapsed
            ? <PanelLeftOpen size={16} strokeWidth={2} aria-hidden="true" />
            : <PanelLeftClose size={16} strokeWidth={2} aria-hidden="true" />}
          <span>Collapse</span>
        </button>
      )}

      {tip.node}
    </div>
  )
}

// ---------------------------------------------------------------------------
// The rail tooltip
// ---------------------------------------------------------------------------

interface TipState { label: string; top: number; left: number }

/**
 * `:focus-visible`, guarded.
 *
 * `matches()` THROWS a SyntaxError on a selector the engine does not know, and
 * this runs inside a focus handler: an unsupported pseudo-class would take
 * keyboard navigation down with it rather than merely skipping a tooltip.
 * Failing closed shows no tooltip, which is the safe direction.
 */
function isFocusVisible(el: Element): boolean {
  try { return el.matches(':focus-visible') } catch { return false }
}

/**
 * Identifying a destination without its label, layer 2 of 3.
 *
 * Layer 1 is the `aria-label` on every rail button; layer 3 is the touch hold
 * below. This is the hover / `:focus-visible` layer.
 *
 * THERE IS NO PAGE-HEADER LAYER, and an earlier revision of this comment said
 * there was. It claimed "the tab's own page header, which already ships and
 * answers it on touch where there is no hover at all" — inherited from the design
 * spec, which opened on that premise and used it to justify an icon-only rail.
 * Measured at rail density: ZERO of the eleven destinations name themselves in a
 * page heading and five render no heading at all. The claim reached `docs/HELP.md`
 * and `README.md` before it was caught, and `design-refinement.md` now records the
 * struck layer.
 *
 * It is left written down rather than quietly deleted because of what it would
 * cost the next reader: it says touch is already handled, which is exactly the
 * belief that would justify removing the touch hold as redundant. **The touch
 * hold is the only thing that names a destination on a touch device in the rail**
 * — there is no hover and no focus ring there, and iPad portrait is the rail's
 * primary device. Do not delete it, and do not re-derive the page-header layer
 * without first grepping for a component that draws one.
 *
 * `position: fixed`, positioned from the trigger's live rect. It has to escape
 * the column: `.sr-nav-col` scrolls vertically, and a box with `overflow-y: auto`
 * computes `overflow-x` to `auto` as well, so a tooltip parented inside it would
 * be clipped at the column's edge. Fixed also means the two offsets are already
 * viewport-relative and therefore already correct under the iOS safe-area insets,
 * which is why this is the one pinned surface in the app that needs no
 * `.sr-ios-app` gate.
 */
function useRailTooltip(rail: boolean) {
  const [tip, setTip] = useState<TipState | null>(null)
  const [tipDensity, setTipDensity] = useState(rail)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Adjusting state while the density changes, React's documented alternative to
  // an effect that calls setState (which would cost a cascading render and is
  // rejected by react-hooks/set-state-in-effect). A tooltip belongs to the rail;
  // when the density leaves the rail the tooltip has to go with it, or a stale
  // one reappears the next time the rail is shown. Rendering `null` while
  // non-rail would hide it but not drop it, which is the bug this closes.
  if (tipDensity !== rail) {
    setTipDensity(rail)
    setTip(null)
  }

  const clearHold = useCallback(() => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
  }, [])

  const hide = useCallback(() => {
    clearHold()
    setTip(null)
  }, [clearHold])

  const showFor = useCallback((el: HTMLElement, label: string) => {
    const r = el.getBoundingClientRect()
    setTip({ label, top: Math.round(r.top + r.height / 2), left: Math.round(r.right + 9) })
  }, [])

  // An unmount takes the pending touch-hold with it. (The density change is
  // handled above, during render.)
  useEffect(() => () => clearHold(), [clearHold])

  // Escape dismisses. Bubble phase and deliberately NOT stopped: dismissing a
  // tooltip must not swallow an Escape the rest of the app is listening for.
  useEffect(() => {
    if (!tip) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') hide() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [tip, hide])

  const handlers = useCallback((label: string) => {
    if (!rail) return {}
    return {
      onMouseEnter: (e: React.MouseEvent<HTMLElement>) => showFor(e.currentTarget, label),
      onMouseLeave: hide,
      // :focus-visible only — a click already showed the hover tooltip, and a
      // pointer-driven focus should not leave one behind.
      onFocus: (e: React.FocusEvent<HTMLElement>) => {
        if (isFocusVisible(e.currentTarget)) showFor(e.currentTarget, label)
      },
      onBlur: hide,
      // Touch hold: 350ms without moving shows the same tooltip. LOAD-BEARING on
      // a touch device, not a nicety — there is no hover and no focus ring there,
      // so in the rail this is the only thing that puts a destination's name on
      // screen. iPad portrait is the rail's primary device. See the header above.
      // 350ms clears the platform's own tap and scroll thresholds without
      // reaching the long-press that would open a system menu.
      onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
        if (e.pointerType !== 'touch') return
        const el = e.currentTarget
        clearHold()
        holdTimer.current = setTimeout(() => showFor(el, label), 350)
      },
      onPointerMove: (e: React.PointerEvent<HTMLElement>) => {
        if (e.pointerType === 'touch') clearHold()
      },
      onPointerUp: hide,
      onPointerCancel: hide,
    }
  }, [rail, showFor, hide, clearHold])

  const node = tip ? (
    <div
      className="sr-nav-tip sr-nav-tip--on"
      aria-hidden="true"
      // Custom properties carrying MEASURED values, the house shape for a px
      // number derived from a ref (SharePopup's --sr-share-body-cap). The
      // positioning itself lives in the class.
      style={{ ['--sr-nav-tip-top' as string]: `${tip.top}px`, ['--sr-nav-tip-left' as string]: `${tip.left}px` }}
    >
      {tip.label}
    </div>
  ) : null

  return { handlers, node }
}

// ---------------------------------------------------------------------------
// Density 3 — the phone bottom bar
// ---------------------------------------------------------------------------

interface NavBottomBarProps {
  items: NavItem[]
  activeTab: Tab
  onSelect: (tab: Tab) => void
  navBarRef?: (el: HTMLElement | null) => void
  inert?: boolean
}

function NavBottomBar({ items, activeTab, onSelect, navBarRef, inert }: NavBottomBarProps) {
  const [sheetOpen, setSheetOpen] = useState(false)
  const moreRef = useRef<HTMLButtonElement>(null)
  const barRef = useRef<HTMLElement>(null)
  useNavBarHeight(barRef)

  // The first four of the saved VISIBLE order. The existing reorder-and-hide
  // setting already chooses them; nothing new is stored. Settings is appended
  // after that order and is never a favourite, so it always lives under More.
  const favourites = items.filter(it => it.id !== 'settings').slice(0, PHONE_FAVOURITES)
  const favouriteIds = new Set(favourites.map(it => it.id))
  const overflow = items.filter(it => !favouriteIds.has(it.id))
  // When the active destination lives under More, the More cell carries the
  // active treatment, so the bar is never showing nothing selected. Its label
  // stays "More".
  const overflowActive = !favouriteIds.has(activeTab)

  const closeSheet = useCallback((returnFocus: boolean) => {
    setSheetOpen(false)
    if (returnFocus) moreRef.current?.focus()
  }, [])

  return (
    <>
      <nav
        className="sr-navbar"
        aria-label="Main navigation"
        inert={inert}
        ref={el => {
          barRef.current = el
          navBarRef?.(el)
        }}
        // A VALUE, not a layout declaration: the grid template lives in the
        // class and reads this. It is the cell count, which is five in every
        // shipped configuration but fewer if the user has hidden almost
        // everything (a one-visible-tab layout leaves two cells).
        style={{ ['--sr-navbar-cells' as string]: String(favourites.length + 1) }}
      >
        {favourites.map(item => {
          const active = item.id === activeTab
          const Icon = item.icon
          return (
            <button
              key={item.id}
              tabIndex={0}
              type="button"
              // NOT a roving group. Roving buys nothing across four items, plain
              // stops are the app's default posture, and a tablist cannot legally
              // contain the non-tab More button beside them.
              className={'sr-navbar-cell' + (active ? ' sr-navbar-cell--active' : '')}
              aria-current={active ? 'true' : undefined}
              onClick={() => onSelect(item.id)}
            >
              <span className="sr-navbar-glyph">
                <Icon size={NAV_ICON.bar.size} strokeWidth={NAV_ICON.bar.strokeWidth} />
              </span>
              <span className="sr-navbar-label">{item.label}</span>
            </button>
          )
        })}

        <button
          ref={moreRef}
          tabIndex={0}
          type="button"
          className={'sr-navbar-cell' + (overflowActive ? ' sr-navbar-cell--active' : '')}
          aria-haspopup="dialog"
          aria-expanded={sheetOpen}
          aria-label="More destinations"
          onClick={() => setSheetOpen(o => !o)}
        >
          <span className="sr-navbar-glyph">
            <MoreHorizontal size={NAV_ICON.bar.size} strokeWidth={NAV_ICON.bar.strokeWidth} aria-hidden="true" />
          </span>
          <span className="sr-navbar-label">More</span>
        </button>
      </nav>

      {sheetOpen && (
        <NavMoreSheet
          items={overflow}
          activeTab={activeTab}
          inert={inert}
          onSelect={id => { onSelect(id); closeSheet(true) }}
          onClose={() => closeSheet(true)}
        />
      )}
    </>
  )
}

/**
 * Publish the bar's measured height so the page can clear it.
 *
 * The bar is `position: fixed`, so it is out of flow: without this the footer
 * would sit under it on every tab. `.sr-shell--phone` reads the property as
 * bottom padding, and lib/mapPanelChrome.ts separately measures this same element
 * for the map panel's own budget (a fixed bar is not in <main>'s sibling flow, so
 * it is not in that module's `above`/`below` terms either).
 *
 * Measured rather than budgeted, for the reason the map-chrome module gives at
 * length: the bar is text, so it grows with the in-app text scale, and its labels
 * drop out entirely under a container query at large scales. No single constant
 * is right at both ends.
 *
 * Written on <html> — the same place --sr-text-scale lives — and reset on unmount
 * so a density flip back to the rail cannot leave stale padding behind.
 */
function useNavBarHeight(barRef: RefObject<HTMLElement | null>): void {
  const published = useRef<number | null>(null)

  useLayoutEffect(() => {
    const root = document.documentElement
    const measure = () => {
      const bar = barRef.current
      if (!bar) return
      const h = Math.ceil(bar.getBoundingClientRect().height)
      if (!Number.isFinite(h) || h <= 0 || h === published.current) return
      published.current = h
      root.style.setProperty(NAV_BAR_HEIGHT_VAR, `${h}px`)
    }
    measure()
    let ro: ResizeObserver | undefined
    if (typeof ResizeObserver !== 'undefined' && barRef.current) {
      ro = new ResizeObserver(measure)
      ro.observe(barRef.current)
    }
    return () => {
      ro?.disconnect()
      published.current = null
      root.style.removeProperty(NAV_BAR_HEIGHT_VAR)
    }
  }, [barRef])
}

// ---------------------------------------------------------------------------
// The More sheet
// ---------------------------------------------------------------------------

interface NavMoreSheetProps {
  items: NavItem[]
  activeTab: Tab
  onSelect: (tab: Tab) => void
  onClose: () => void
  inert?: boolean
}

/**
 * A bottom sheet, deliberately NOT the shared ModalDialog: that shell is centred
 * and is for confirmations, and this is a navigation surface that has to read as
 * rising from the bar it was opened from. It borrows every BEHAVIOUR the shell
 * already proves — one close path for Escape, the backdrop and choosing a
 * destination; the shared focus trap, re-querying its focusables per Tab; focus
 * returned to the opener.
 *
 * THE TRAP RUNS ITS KEYDOWN END-WRAP ARM ONLY. `containOutsideFocus` is not
 * passed and defaults to false, which is byte-for-byte what `ModalDialog` does.
 * An earlier revision of this comment claimed the trap "contains on `focusin`",
 * which it does not — the same class of defect as the page-header claim above,
 * so it is corrected rather than softened.
 *
 * WHAT THE CONTAINMENT ACTUALLY RESTS ON, because it is a property of the MARKUP
 * and not of this hook: the keydown arm decides "is focus at the boundary?" by
 * comparing `document.activeElement` against the ends of a `querySelectorAll`
 * list, which is a PREDICTION of the engine's tab order. That prediction is
 * correct here only because every focusable in this panel carries a literal
 * `tabIndex={0}` — the rows, and nothing else is focusable inside it — so
 * WebKit's default tab mode visits exactly the list the hook built. Where that
 * stopped being true is precisely the v1.0.15 measurement in `useFocusTrap`'s
 * own header: unmarked controls made the real order end five elements early and
 * focus escaped after five Tab presses.
 *
 * SO: adding any focusable to this panel without `tabIndex={0}` silently reopens
 * that hole. Mark it, which is the app-wide rule anyway and what
 * `tabOrderCoverage.test.ts` enforces.
 *
 * ENABLING `containOutsideFocus` IS NOT A FREE UPGRADE, and this was measured
 * rather than reasoned: the `focusin` arm pulls focus back into the panel
 * whenever it lands outside, and `closeSheet(true)` focuses the More button
 * SYNCHRONOUSLY while this component is still mounted, so the trap yanks focus
 * back into a sheet that then unmounts and drops it to `<body>` — the F061
 * defect. Turning the option on failed both focus-return tests in exactly that
 * way. Doing it properly would mean moving the focus restore into an effect that
 * runs after the close commits (the `restoreFiltersFocusRef` pattern in
 * `MapExplorer`), which is a change to a working close path and is not worth
 * making on a panel whose every control is already explicitly marked.
 */
function NavMoreSheet({ items, activeTab, onSelect, onClose, inert }: NavMoreSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useFocusTrap(true, panelRef)

  // Mount closed, then open on the next frame so the transform actually
  // transitions rather than starting at its end state.
  useLayoutEffect(() => {
    const id = requestAnimationFrame(() => setOpen(true))
    return () => cancelAnimationFrame(id)
  }, [])

  // Focus lands on the active destination if it is in here, else the first row.
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const rows = Array.from(panel.querySelectorAll<HTMLButtonElement>('button.sr-nav-item'))
    const idx = Math.max(0, items.findIndex(it => it.id === activeTab))
    ;(rows[idx] ?? rows[0])?.focus()
  }, [items, activeTab])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className={'sr-nav-sheet-root' + (open ? ' sr-nav-sheet-root--open' : '')}
      role="dialog"
      aria-modal="true"
      aria-label="More destinations"
      inert={inert}
      // mousedown, not click: a click that STARTED inside the panel and ended on
      // the backdrop must not close it.
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="sr-nav-sheet" ref={panelRef}>
        <div className="sr-nav-sheet-handle" aria-hidden="true" />
        <h2>More</h2>
        {items.map((item, i) => {
          const active = item.id === activeTab
          const Icon = item.icon
          return (
            <Fragment key={item.id}>
              {item.id === 'settings' && i > 0 && <hr className="sr-nav-sep" aria-hidden="true" />}
              <button
                tabIndex={0}
                type="button"
                // Plain buttons inside the trap, NOT a roving group: this is what
                // retires the old dropdown's role="option" listbox exception.
                className={'sr-nav-item' + (active ? ' sr-nav-item--active' : '')}
                aria-current={active ? 'true' : undefined}
                onClick={() => onSelect(item.id)}
              >
                <Icon size={NAV_ICON.sheet.size} strokeWidth={NAV_ICON.sheet.strokeWidth} />
                <span>{item.label}</span>
              </button>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
