// The Settings tab's accessible radio group, lifted out of Settings.tsx
// unchanged (ios-alerts) so the lazy Alerts section can use the same control
// without importing the whole tab. Settings.tsx imports it back; its rendered
// markup is byte-identical (settingsAlertsOff.test.tsx holds the tab to a
// fixture captured before the move).

import { Button } from '../ui/Button'

// ---- Accessible radio group (APG pattern) ----
//
// role="radiogroup" with role="radio" buttons, roving tabindex, and
// Arrow/Home/End key navigation that moves the checked option — what a screen
// reader announces ("radio, 1 of N — use arrow keys") then actually works, and
// only the checked radio is a Tab stop. Generic over the option key type.
export interface RadioOption<T extends string | number> {
  key: T
  /** Accessible name for the radio (falls back to the rendered children). */
  ariaLabel?: string
  style: React.CSSProperties
  children: React.ReactNode
}

export function RadioGroup<T extends string | number>({
  label, value, options, onChange, describedBy,
}: {
  label: string
  value: T
  options: RadioOption<T>[]
  onChange: (key: T) => void
  /** ios-alerts: the group's description line, by id (absent renders nothing). */
  describedBy?: string
}) {
  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const idx = options.findIndex(o => o.key === value)
    if (idx < 0) return
    let next: number
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') next = (idx + 1) % options.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') next = (idx - 1 + options.length) % options.length
    else if (e.key === 'Home') next = 0
    else if (e.key === 'End') next = options.length - 1
    else return
    e.preventDefault()
    const nextKey = options[next].key
    if (nextKey !== value) onChange(nextKey)
    // Move focus to the newly checked radio (roving tabindex).
    const group = e.currentTarget
    const radios = group.querySelectorAll<HTMLButtonElement>('[role="radio"]')
    radios[next]?.focus()
  }

  return (
    <div role="radiogroup" aria-label={label} aria-describedby={describedBy} className="sr-wrap-flex" style={{ ['--sr-wrap-gap' as string]: '6px' }} onKeyDown={handleKeyDown}>
      {options.map(o => {
        const checked = o.key === value
        return (
          <Button
            key={o.key}
            role="radio"
            aria-checked={checked}
            aria-label={o.ariaLabel}
            tabIndex={checked ? 0 : -1}
            style={o.style}
            onClick={() => onChange(o.key)}
          >
            {o.children}
          </Button>
        )
      })}
    </div>
  )
}
