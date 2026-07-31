interface ToggleSwitchProps {
  label: string
  checked: boolean
  onChange: () => void
  /** Keep the accessible name while using the compact trailing-switch treatment. */
  labelVisible?: boolean
  disabled?: boolean
  busy?: boolean
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
}: ToggleSwitchProps) {
  return (
    <button tabIndex={0}
      role="switch"
      aria-checked={checked}
      aria-busy={busy || undefined}
      onClick={onChange}
      disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        height: 30, padding: '0 10px 0 8px', borderRadius: 6,
        border: '1.5px solid var(--sr-border)', background: 'var(--sr-surface)',
        cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: 'inherit', fontSize: '0.75rem', fontWeight: 500,
        color: disabled ? 'var(--sr-text-disabled)' : 'var(--sr-text-muted)', whiteSpace: 'nowrap',
        opacity: disabled ? 0.72 : 1,
      }}
    >
      <div style={{
        width: 28, height: 16, borderRadius: 8, flexShrink: 0, position: 'relative',
        background: checked ? 'var(--sr-accent)' : 'var(--sr-gray-400)',
        transition: 'background 180ms ease-out',
      }}>
        <div style={{
          width: 12, height: 12, borderRadius: '50%',
          background: 'var(--sr-switch-thumb)',
          position: 'absolute', top: 2,
          left: checked ? 14 : 2,
          transition: 'left 180ms ease-out',
          boxShadow: 'var(--sr-switch-thumb-shadow)',
        }} />
      </div>
      <span className={labelVisible ? undefined : 'sr-only'}>{label}</span>
    </button>
  )
}
