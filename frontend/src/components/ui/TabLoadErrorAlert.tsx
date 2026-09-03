// The shared load-failure live region for the eight data tabs (Statistics, the
// Calendar, Checklists, Breeding Codes, Named Birds, Species Detail, Multimedia
// and the Map Explorer).
//
// WHY THIS IS A COMPONENT AND NOT SIX COPIES OF `role="alert"`.
//
// Every one of these tabs renders its load failure from an early `return` in a
// phase switch, so an `role="alert"` written there is CREATED at the instant its
// text exists. That is the repo's documented insert-with-first-message trap
// (DECISIONS.md v0.5.83, `.claude/rules/ui.md`): a live region must already be in
// the ACCESSIBILITY TREE when its message arrives, or the announcement is simply
// missed. Calendar and the Map Explorer both carried `role="alert"` in exactly
// that broken shape before this change; they were corrected here rather than
// copied, because shipping six more copies of a pattern we know is broken and
// leaving two behind is worse than either.
//
// The repair is structural. This component renders THREE things that are always
// mounted -- the frame, the region, and (for the Statistics variant) the column
// between them -- and populates them afterwards. The caller mounts it at
// fragment index 0 of every branch that can reach the error phase, so React
// reconciles it to the SAME DOM node across every phase transition and the
// region is in the tree before any message lands in it. `TabLoadErrorAlert.test.tsx`
// asserts that by node identity over a roster of all eight tabs, not by reading
// the call sites.
//
// THE MESSAGE IS A KEYED CHILD (the v0.5.80 house posture): the region itself
// never changes, only its child. The key is the MESSAGE, not a sequence counter,
// and that is a deliberate departure worth its own paragraph. v0.5.80's counter
// exists so that pressing one control twice announces twice when the resulting
// sentence is identical; there is no control here, and the two shapes differ
// only on an identical message replacing itself with the region never emptied,
// which is the one transition this component deliberately does not re-announce
// (see below). Everything else keys the same way: a DIFFERENT message replaces
// the node rather than updating a text node, and the same message arriving after
// the region has emptied is a fresh mount either way. A counter would also have
// to be state, and advancing it in an effect is what `react-hooks/set-state-in-effect`
// (build-blocking here) forbids, while advancing it during render is impure --
// so the honest options were the message key or a token prop at all eight call
// sites, and the token buys nothing the message key does not.
//
// HONEST NOTE ON WHAT THE KEY REJECTS, per the ui.md rule that a guard whose
// discrimination has been shown to be absent must say so in its own comment and
// name what DOES carry the guarantee. It rejects nothing here today. The message
// node UNMOUNTS whenever the region is empty, and every repeat of the same
// sentence reachable from the eight call sites passes through an empty region
// first -- six tabs reset to a loading phase before every reload, and the Map
// Explorer clears the message when you leave the My Sightings view and restores
// it when you come back, which is the one repeat a user actually drives. A
// remount is already a real DOM addition, so an UNKEYED child would announce all
// of those too (the v0.5.81 nuance). What carries the announcement is the
// assertion that the REGION node is stable while its child is inserted, and
// `TabLoadErrorAlert.test.tsx` is written to fail if the region is remounted
// along with its message. The key is kept because it is the house posture and
// because it is what keeps the guarantee true if a future change ever stops
// emptying the region between two messages.
//
// The one transition that deliberately does NOT re-announce: an identical
// message replacing itself with the region never emptied (a second background
// reload failing the same way on Statistics or the Map Explorer, neither of
// which resets the phase). Nothing observable changed -- the panel on screen
// already says exactly that sentence -- so re-reading it would tell a screen
// reader something a sighted user is not being told.
//
// WHY THE REGION IS THE MESSAGE BOX AND NOT THE WHOLE PANEL. `role="alert"` on
// the outer panel would put "Go to Settings" into the announced text along with
// the sentence -- which is what both shipped precedents did. The region is the
// box that holds the icon and the sentence and nothing else, so its
// `textContent` is exactly what should be read; the action button is its
// sibling.
//
// THE ICON'S `aria-hidden` IS EXPLICIT, and the usual reason given for it is
// wrong in two ways worth recording, because four of these eight panels shipped
// without one and the change brief called that a defect. An `<svg>` of paths
// contributes nothing to `textContent`, so it was never "polluting" the
// announced string; and lucide-react 1.14 adds `aria-hidden="true"` itself
// whenever an icon has no children and no a11y prop
// (`!children && !hasA11yProp(rest)`), so those four were already hidden from
// assistive technology at runtime. The prop is set here anyway because it makes
// the guarantee this component's own rather than a dependency's default, and
// because it is the one line that would keep announcing right if that default
// ever changed. It is not a bug fix; nothing a user could hear was different.
//
// WHY THE STYLES ARE CONDITIONAL RATHER THAN A CLASS TOGGLE. An always-mounted
// region must have no visual footprint while it is idle, and it must not be
// hidden to get one: `display: none` is the very defect this file exists to fix.
// Empty, the three elements carry no inline styles and no content, so they
// compute to zero height and shift nothing. Populated, they carry byte-identical
// inline styles to the eight panels that shipped before this change, so there is
// no visual change on any tab. `lib/tabLoadAlertCss.test.ts` guards the
// stylesheet side: nothing may give any of the three classes a hiding
// `display` / `visibility` / `content-visibility`, at any depth.

import { Fragment } from 'react'
import type { CSSProperties } from 'react'
import { AlertCircle } from 'lucide-react'

/** Which of the two shipped panel treatments to render. */
export type TabLoadErrorVariant = 'panel' | 'stats'

type Props = {
  /** The failure sentence, or `null` in every other phase. */
  message: string | null
  onGoToSettings: () => void
  /**
   * `panel` (default) is the tinted error chip plus an outline "Go to Settings"
   * button, shipped on seven tabs. `stats` is the Statistics tab's untinted
   * treatment with the accent button. Both reproduce their tab's pre-existing
   * markup exactly; a tab's variant never changes at runtime.
   */
  variant?: TabLoadErrorVariant
}

type VariantStyles = {
  frame: CSSProperties
  /** Only the `stats` variant has a column between the frame and the region. */
  inner: CSSProperties | null
  box: CSSProperties
  button: CSSProperties
  buttonLabel: string
  iconSize: number
  iconStrokeWidth: number | undefined
}

const VARIANTS: Record<TabLoadErrorVariant, VariantStyles> = {
  panel: {
    frame: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 },
    inner: null,
    box: { display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: 'var(--sr-error-bg)', borderRadius: 8, fontSize: '0.8125rem', color: 'var(--sr-error)', maxWidth: 480 },
    button: { height: 32, padding: '0 14px', borderRadius: 6, border: '1.5px solid var(--sr-border)', background: 'var(--sr-surface)', color: 'var(--sr-text-muted)', fontSize: '0.75rem', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' },
    buttonLabel: 'Go to Settings',
    iconSize: 14,
    iconStrokeWidth: 2.5,
  },
  stats: {
    frame: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' },
    inner: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center', maxWidth: 420 },
    box: { display: 'flex', alignItems: 'center', gap: 8, color: 'var(--sr-error)', fontSize: '0.875rem' },
    button: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px', background: 'var(--sr-accent)', color: 'var(--sr-on-accent)', border: 'none', borderRadius: 8, fontSize: '0.84375rem', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' },
    buttonLabel: 'Go to Settings →',
    iconSize: 16,
    iconStrokeWidth: undefined,
  },
}

export function TabLoadErrorAlert({ message, onGoToSettings, variant = 'panel' }: Props) {
  const v = VARIANTS[variant]
  const showing = message !== null

  const region = (
    <div
      role="alert"
      className="sr-tab-load-alert sr-wrap-anywhere"
      style={showing ? v.box : undefined}
    >
      {showing ? (
        // A keyed FRAGMENT, not a keyed wrapper element: the icon and the
        // sentence must stay DIRECT children of the flex box or the `gap: 8`
        // between them collapses. Re-keying a Fragment remounts its children,
        // which is the real node replacement the announcement needs.
        <Fragment key={message}>
          <AlertCircle
            size={v.iconSize}
            strokeWidth={v.iconStrokeWidth}
            style={{ flexShrink: 0 }}
            aria-hidden="true"
          />
          {message}
        </Fragment>
      ) : null}
    </div>
  )

  const action = showing ? (
    <button type="button" tabIndex={0} onClick={onGoToSettings} style={v.button}>
      {v.buttonLabel}
    </button>
  ) : null

  return (
    <div className="sr-tab-load-alert-frame" style={showing ? v.frame : undefined}>
      {v.inner === null ? (
        <>
          {region}
          {action}
        </>
      ) : (
        <div className="sr-tab-load-alert-inner" style={showing ? v.inner : undefined}>
          {region}
          {action}
        </div>
      )}
    </div>
  )
}
