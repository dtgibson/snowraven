// Programmatic smooth-scroll that honors the OS "reduce motion" setting.
//
// globals.css sets `scroll-behavior: auto !important` under
// @media (prefers-reduced-motion: reduce), but that CSS property does NOT govern
// a JS `scrollIntoView()` call that passes an explicit `behavior` — the option
// wins over the property (CSSOM View spec). So a bare
// `el.scrollIntoView({ behavior: 'smooth' })` still animates for reduced-motion
// users, contradicting the reduced-motion promise in ACCESSIBILITY.md. Route all
// programmatic "jump to" scrolls through this helper so the promise holds.

/** True when the OS requests reduced motion. Guarded for non-DOM/test environments. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/**
 * `scrollIntoView` that animates smoothly unless the user has asked for reduced
 * motion, in which case it jumps instantly. No-ops on a null/undefined target.
 */
export function smoothScrollIntoView(
  el: Element | null | undefined,
  opts: Omit<ScrollIntoViewOptions, 'behavior'> = { block: 'start' },
): void {
  if (!el) return
  el.scrollIntoView({ ...opts, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
}

/**
 * In-page "jump to" navigation that ALSO moves keyboard focus to the
 * destination. A fragment jump that only scrolls leaves focus on the link, so a
 * keyboard user's next Tab resumes from the nav rather than the jumped-to
 * section (WCAG 2.4.3 Focus Order). After the motion-aware scroll, this focuses
 * the target — it must carry `tabindex="-1"` so a non-interactive container can
 * receive programmatic focus. `preventScroll` avoids a second competing scroll
 * on top of `smoothScrollIntoView`'s. No-ops on a null/undefined target.
 */
export function jumpTo(
  el: (Element & { focus?: (opts?: FocusOptions) => void }) | null | undefined,
  opts: Omit<ScrollIntoViewOptions, 'behavior'> = { block: 'start' },
): void {
  if (!el) return
  smoothScrollIntoView(el, opts)
  el.focus?.({ preventScroll: true })
}
