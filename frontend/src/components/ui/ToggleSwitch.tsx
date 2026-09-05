interface ToggleSwitchProps {
  label: string
  checked: boolean
  onChange: () => void
  /** Keep the accessible name while using the compact trailing-switch treatment. */
  labelVisible?: boolean
  disabled?: boolean
  busy?: boolean
  /** Chromeless variant: drops the bordered-button frame so the switch itself is
      the control, with a slightly larger track that holds its own without the
      frame. For rows whose visible label is the row text (Settings). */
  bare?: boolean
  /** Name the switch by another element (its section header) instead of the
      hidden label span, and describe it by others (icloud-sync). */
  labelledBy?: string
  describedBy?: string
  /** Not operable, but still focusable so an associated reason is read in
      place (icloud-api-key-sync FR-02): renders aria-disabled="true", ignores
      activation, and takes the disabled look. */
  ariaDisabled?: boolean
}

/**
 * Pill-style on/off switch with a sliding knob. Announces as a `switch` to assistive
 * tech. Shared by the tabs that previously each defined an identical copy.
 */
export function ToggleSwitch({
  label,
  checked,
  onChange,
  labelVisible = true,
  disabled = false,
  busy = false,
  bare = false,
  labelledBy,
  describedBy,
  ariaDisabled = false,
}: ToggleSwitchProps) {
  const inert = disabled || ariaDisabled
  // Track/knob geometry: the bare variant is slightly larger (36×20 / 16px)
  // because it stands alone without the frame; the boxed default stays 28×16.
  const trackW = bare ? 36 : 28
  const trackH = bare ? 20 : 16
  const knob = bare ? 16 : 12
  return (
    <button tabIndex={0}
      role="switch"
      aria-checked={checked}
      aria-busy={busy || undefined}
      aria-labelledby={labelledBy}
      aria-describedby={describedBy}
      aria-disabled={ariaDisabled || undefined}
      onClick={ariaDisabled ? undefined : onChange}
      disabled={disabled}
      className={bare ? 'sr-touch-target' : 'sr-toggle'}
      style={bare ? {
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: 7, borderRadius: 999,
        border: 'none', background: 'none',
        cursor: inert ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 500,
        color: inert ? 'var(--sr-text-disabled)' : 'var(--sr-text-muted)', whiteSpace: 'nowrap',
        opacity: inert ? 0.72 : 1, transition: 'opacity 150ms ease-out',
      } : {
        // The boxed chrome's `border`, `background` and `transition` live on the
        // `.sr-toggle` rule in globals.css, not here, so a `:hover` rule can
        // win: an inline value is specificity 1,0,0 and beats every class rule,
        // which is why this variant had no pointer feedback before
        // species-detail-escapee-toggle. Every other value stays inline and
        // byte-identical, as do the track and the knob below.
        display: 'inline-flex', alignItems: 'center', gap: 7,
        height: 30, padding: '0 10px 0 8px', borderRadius: 6,
        cursor: inert ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 500,
        color: inert ? 'var(--sr-text-disabled)' : 'var(--sr-text-muted)', whiteSpace: 'nowrap',
        opacity: inert ? 0.72 : 1,
      }}
    >
      <div style={{
        width: trackW, height: trackH, borderRadius: trackH / 2, flexShrink: 0, position: 'relative',
        background: checked ? 'var(--sr-accent)' : 'var(--sr-gray-400)',
        transition: 'background 180ms ease-out',
      }}>
        <div style={{
          width: knob, height: knob, borderRadius: '50%',
          background: 'var(--sr-switch-thumb)',
          position: 'absolute', top: 2,
          left: checked ? trackW - knob - 2 : 2,
          transition: 'left 180ms ease-out',
          boxShadow: 'var(--sr-switch-thumb-shadow)',
        }} />
      </div>
      <span className={labelVisible ? undefined : 'sr-only'}>{label}</span>
    </button>
  )
}
