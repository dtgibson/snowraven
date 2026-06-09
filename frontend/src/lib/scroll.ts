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
