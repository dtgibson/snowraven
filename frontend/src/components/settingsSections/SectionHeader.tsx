// The Settings tab's section header, lifted out of Settings.tsx unchanged
// (ios-alerts) so the lazy Alerts section draws the same header. Settings.tsx
// imports it back; its rendered markup is byte-identical
// (settingsAlertsOff.test.tsx holds the tab to a fixture captured before the
// move).

// ---- Section header ----

export function SectionHeader({ label, id }: { label: string; id?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
      {/* No `white-space: nowrap` (v1.0.4). Uppercased and letter-spaced, the
          longest header ("Help & Documentation") measures 297.14px inside a 272px
          panel at 320px and 200% text scale, and nowrap made that unbreakable —
          1.14px of page horizontal scroll, the last leak on any tab. Allowing the
          wrap is self-limiting: a flex item only breaks a line it cannot fit, and
          no header comes close at any desktop width, so this is byte-identical
          everywhere else. The divider below then sits beside the final line. */}
      <span id={id} style={{
        fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.07em', color: 'var(--sr-text-muted)',
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'var(--sr-border)' }} />
    </div>
  )
}
