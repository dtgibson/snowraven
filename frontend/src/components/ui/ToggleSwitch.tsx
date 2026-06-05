interface ToggleSwitchProps {
  label: string
  checked: boolean
  onChange: () => void
}

/**
 * Pill-style on/off switch with a sliding knob. Announces as a `switch` to assistive
 * tech. Shared by the tabs that previously each defined an identical copy.
 */
export function ToggleSwitch({ label, checked, onChange }: ToggleSwitchProps) {
  return (
    <button tabIndex={0}
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        height: 30, padding: '0 10px 0 8px', borderRadius: 6,
        border: '1.5px solid var(--sr-border)', background: 'var(--sr-surface)',
        cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
        color: 'var(--sr-text-muted)',
      }}
    >
      <div style={{
        width: 28, height: 16, borderRadius: 8, flexShrink: 0, position: 'relative',
        background: checked ? 'var(--sr-accent)' : 'var(--sr-gray-400)',
        transition: 'background 0.15s',
      }}>
        <div style={{
          width: 12, height: 12, borderRadius: '50%',
          background: 'white',
          position: 'absolute', top: 2,
          left: checked ? 14 : 2,
          transition: 'left 0.15s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
        }} />
      </div>
      {label}
    </button>
  )
}
