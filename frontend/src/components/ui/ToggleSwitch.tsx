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
}: ToggleSwitchProps) {
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
      onClick={onChange}
      disabled={disabled}
      className={bare ? 'sr-touch-target' : undefined}
      style={bare ? {
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: 7, borderRadius: 999,
        border: 'none', background: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 500,
        color: disabled ? 'var(--sr-text-disabled)' : 'var(--sr-text-muted)', whiteSpace: 'nowrap',
        opacity: disabled ? 0.72 : 1,
      } : {
        display: 'inline-flex', alignItems: 'center', gap: 7,
        height: 30, padding: '0 10px 0 8px', borderRadius: 6,
        border: '1.5px solid var(--sr-border)', background: 'var(--sr-surface)',
        cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 500,
        color: disabled ? 'var(--sr-text-disabled)' : 'var(--sr-text-muted)', whiteSpace: 'nowrap',
        opacity: disabled ? 0.72 : 1,
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
