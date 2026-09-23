import { useId } from 'react'
import { Calendar } from 'lucide-react'

/**
 * The desktop drawing each call site had before this component existed, named
 * by the surface that drew it (county-date-filter-mobile).
 *
 * Five hand-drawn copies of one "from, to" pair had drifted into five desktop
 * registers: three inline pill-row pairs that differ only in height (and in
 * whether the From field stretches), the Checklists "Where & when" row, and the
 * Map Explorer sidebar's panel pair. Desktop and iPad must render each of them
 * exactly as before, so the register is chosen per call site and its values
 * live in globals.css under `:where()` (zero specificity), where the <=640
 * phone tier overrides all five with ONE register without `!important`.
 */
export type DateRangeRegister =
  | 'multimedia'
  | 'species-detail'
  | 'breeding-codes'
  | 'checklists'
  | 'map-sidebar'

/** The three pill-row registers, which share the icon wrapper and the arrow. */
const INLINE: ReadonlySet<DateRangeRegister> = new Set(['multimedia', 'species-detail', 'breeding-codes'])

interface DateRangeFieldsProps {
  /** ISO `yyyy-mm-dd`, or '' for no bound. */
  from: string
  to: string
  onFrom: (value: string) => void
  onTo: (value: string) => void
  register: DateRangeRegister
  className?: string
}

/**
 * One "from, to" date range: two native `<input type="date">`, joined into a
 * pair on phones.
 *
 * On a phone iOS paints an EMPTY date input with no text at all, so each field
 * carries a visible "From" / "To" word inside it (phone tier only; desktop keeps
 * its Calendar glyph and arrow). On a phone the FIELD draws the box and the word
 * sits in flow beside a borderless input, and the field wraps the value beneath
 * the word when the two cannot share a line (globals.css says why). The word is
 * a real `<label for>` on a `useId()` id, never an id built from user data, so a
 * tap on it focuses the input. It is `aria-hidden` because the input already
 * speaks it: the accessible names stay `From date` / `To date` through
 * `aria-label`, which contains the visible word (label in name). The arrow
 * between the fields is decorative and hidden from assistive technology
 * everywhere, so VoiceOver no longer reads a "right arrow" between them.
 *
 * `data-set` on each field carries the set state the stylesheet tints from, so
 * no colour is decided inline.
 */
export function DateRangeFields({ from, to, onFrom, onTo, register, className }: DateRangeFieldsProps) {
  const fromId = useId()
  const toId = useId()
  const inline = INLINE.has(register)
  const classes = ['sr-daterange', `sr-daterange--${register}`]
  if (inline) classes.push('sr-daterange--inline')
  // The Map sidebar pair keeps .sr-field-row: its desktop layout (two fields
  // side by side) and the sidebar's own <=640 stacking rules both key on it.
  if (register === 'map-sidebar') classes.push('sr-field-row')
  if (className) classes.push(className)

  return (
    <div className={classes.join(' ')}>
      <div className="sr-daterange-field" data-set={from ? 'true' : undefined}>
        <label htmlFor={fromId} className="sr-ctl-label sr-daterange-word" aria-hidden="true">From</label>
        {inline && (
          <Calendar size={11} strokeWidth={2} className="sr-daterange-glyph" style={{
            position: 'absolute', left: 7, color: from ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
            pointerEvents: 'none',
          }} />
        )}
        <input
          id={fromId}
          type="date"
          className="sr-input-16 sr-daterange-input"
          aria-label="From date"
          value={from}
          onChange={e => onFrom(e.target.value)}
        />
      </div>
      {register !== 'map-sidebar' && <span className="sr-daterange-arrow" aria-hidden="true">→</span>}
      <div className="sr-daterange-field" data-set={to ? 'true' : undefined}>
        <label htmlFor={toId} className="sr-ctl-label sr-daterange-word" aria-hidden="true">To</label>
        <input
          id={toId}
          type="date"
          className="sr-input-16 sr-daterange-input"
          aria-label="To date"
          value={to}
          onChange={e => onTo(e.target.value)}
        />
      </div>
    </div>
  )
}
