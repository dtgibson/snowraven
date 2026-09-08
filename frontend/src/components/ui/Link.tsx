import { forwardRef, type ComponentPropsWithoutRef } from 'react'

export type LinkProps = Omit<ComponentPropsWithoutRef<'a'>, 'href'> & {
  href: string
}

/**
 * The native anchor seam for app-owned href links.
 *
 * It adds only SnowRaven's WebKit-safe tab-order default. Native attributes,
 * handlers, className, style, and children pass through unchanged; callers
 * retain the native anchor ref.
 */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(function Link(
  { tabIndex = 0, ...props },
  ref,
) {
  return <a ref={ref} tabIndex={tabIndex} {...props} />
})
