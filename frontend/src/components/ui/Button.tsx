import { forwardRef, type ComponentPropsWithoutRef } from 'react'

export type ButtonProps = ComponentPropsWithoutRef<'button'>

/**
 * The native button seam for app-owned controls.
 *
 * It adds only SnowRaven's WebKit-safe tab-order default. Native attributes,
 * handlers, className, style, children, and the absence or presence of `type`
 * pass through unchanged; callers retain the native button ref.
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { tabIndex = 0, ...props },
  ref,
) {
  return <button ref={ref} tabIndex={tabIndex} {...props} />
})
