// The per-card badge row inside ChecklistTag: six fixed-order badges summarizing
// one checklist's media (photo/audio/video), breeding evidence, and embedded
// weather/tide comment blocks. All six always render (present or absent) so cards
// A and B align column-for-column. State is conveyed by icon + fill/outline +
// aria-label/title — never by color alone, never by text opacity (NFR-04). All
// color via var(--sr-*). See design-spec §A.

import { Camera, Mic, Video, Dna, CloudSun, Waves } from 'lucide-react'
import type { BadgeFlags } from '../lib/checklistBadges'

// One badge: an icon + the type word, in a present (accent fill + accent-strong
// label) or absent (transparent fill + subtle outline + muted label) state.
function Badge({ icon, label, present, presentTitle, absentTitle }: {
  icon: React.ReactNode
  label: string
  present: boolean
  presentTitle: string
  absentTitle: string
}) {
  const title = present ? presentTitle : absentTitle
  return (
    <span
      role="img"
      title={title}
      aria-label={title}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        padding: '2px 6px', borderRadius: 5, lineHeight: 1.4,
        fontSize: '0.625rem', fontWeight: 600, letterSpacing: '0.02em',
        color: present ? 'var(--sr-accent-strong)' : 'var(--sr-text-muted)',
        background: present ? 'var(--sr-accent-bg)' : 'transparent',
        border: present ? '1px solid var(--sr-accent-border)' : '1px solid var(--sr-border)',
      }}
    >
      {icon}
      {label}
    </span>
  )
}

function Divider() {
  return (
    <span aria-hidden="true" style={{
      width: 1, height: 13, background: 'var(--sr-border)', opacity: 0.7, margin: '0 1px',
    }} />
  )
}

const ICON = { size: 12, strokeWidth: 2.25 } as const

export function ChecklistBadges({ flags }: { flags: BadgeFlags }) {
  return (
    <div
      role="group"
      aria-label="Checklist contents"
      style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', marginTop: 5 }}
    >
      <Badge icon={<Camera {...ICON} aria-hidden="true" />} label="Photo" present={flags.photo}
        presentTitle="Photos reported" absentTitle="No photos reported" />
      <Badge icon={<Mic {...ICON} aria-hidden="true" />} label="Audio" present={flags.audio}
        presentTitle="Audio reported" absentTitle="No audio reported" />
      <Badge icon={<Video {...ICON} aria-hidden="true" />} label="Video" present={flags.video}
        presentTitle="Video reported" absentTitle="No video reported" />
      <Divider />
      <Badge icon={<Dna {...ICON} aria-hidden="true" />} label="Breeding" present={flags.breeding}
        presentTitle="Breeding codes reported" absentTitle="No breeding codes reported" />
      <Divider />
      <Badge icon={<CloudSun {...ICON} aria-hidden="true" />} label="Weather" present={flags.weatherComment}
        presentTitle="Weather block in comment" absentTitle="No weather block in comment" />
      <Badge icon={<Waves {...ICON} aria-hidden="true" />} label="Tide" present={flags.tideComment}
        presentTitle="Tide block in comment" absentTitle="No tide block in comment" />
    </div>
  )
}
