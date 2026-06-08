// @vitest-environment jsdom
// Component tests for the per-card badge row (ChecklistBadges). The reducer
// logic that produces BadgeFlags is unit-tested in lib/checklistBadges.test.ts;
// here we verify the *rendering* acceptance criteria: all six badges always
// render in both states, each carries the correct stateful aria-label/title,
// the present/absent state is conveyed without relying on color alone, and the
// component is key-independent (it takes only flags — no transport, no keys).
// Covers QA-01..05 (the render side).
import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ChecklistBadges } from './ChecklistBadges'
import type { BadgeFlags } from '../lib/checklistBadges'

afterEach(cleanup)

const ALL_PRESENT: BadgeFlags = {
  photo: true, audio: true, video: true,
  breeding: true, weatherComment: true, tideComment: true,
}
const ALL_ABSENT: BadgeFlags = {
  photo: false, audio: false, video: false,
  breeding: false, weatherComment: false, tideComment: false,
}

describe('ChecklistBadges — all six always render (QA-01/02/03 alignment)', () => {
  it('renders six badges regardless of state so A and B align column-for-column', () => {
    const { container, rerender } = render(<ChecklistBadges flags={ALL_PRESENT} />)
    // Each badge carries an aria-label (it's the title text). Six labelled spans.
    const present = container.querySelectorAll('span[aria-label]')
    expect(present.length).toBe(6)

    rerender(<ChecklistBadges flags={ALL_ABSENT} />)
    const absent = container.querySelectorAll('span[aria-label]')
    expect(absent.length).toBe(6)
  })

  it('exposes the badge row as a group', () => {
    render(<ChecklistBadges flags={ALL_ABSENT} />)
    expect(screen.getByRole('group')).toBeTruthy()
  })
})

describe('ChecklistBadges — present-state aria-labels (QA-01/02/03)', () => {
  it('shows the present label for every badge when all flags are true', () => {
    render(<ChecklistBadges flags={ALL_PRESENT} />)
    expect(screen.getByLabelText('Photos reported')).toBeTruthy()
    expect(screen.getByLabelText('Audio reported')).toBeTruthy()
    expect(screen.getByLabelText('Video reported')).toBeTruthy()
    expect(screen.getByLabelText('Breeding codes reported')).toBeTruthy()
    expect(screen.getByLabelText('Weather block in comment')).toBeTruthy()
    expect(screen.getByLabelText('Tide block in comment')).toBeTruthy()
  })
})

describe('ChecklistBadges — absent-state aria-labels (QA-01/02/04)', () => {
  it('shows the absent label for every badge when all flags are false', () => {
    render(<ChecklistBadges flags={ALL_ABSENT} />)
    expect(screen.getByLabelText('No photos reported')).toBeTruthy()
    expect(screen.getByLabelText('No audio reported')).toBeTruthy()
    expect(screen.getByLabelText('No video reported')).toBeTruthy()
    expect(screen.getByLabelText('No breeding codes reported')).toBeTruthy()
    expect(screen.getByLabelText('No weather block in comment')).toBeTruthy()
    expect(screen.getByLabelText('No tide block in comment')).toBeTruthy()
  })
})

describe('ChecklistBadges — independent flags & combined weather+tide (QA-03/04)', () => {
  it('photo present + video absent are reflected independently', () => {
    render(<ChecklistBadges flags={{ ...ALL_ABSENT, photo: true }} />)
    expect(screen.getByLabelText('Photos reported')).toBeTruthy()
    expect(screen.getByLabelText('No video reported')).toBeTruthy()
    expect(screen.getByLabelText('No audio reported')).toBeTruthy()
  })

  it('weather block present + tide block absent (weather-only comment)', () => {
    render(<ChecklistBadges flags={{ ...ALL_ABSENT, weatherComment: true }} />)
    expect(screen.getByLabelText('Weather block in comment')).toBeTruthy()
    expect(screen.getByLabelText('No tide block in comment')).toBeTruthy()
  })

  it('tide block present + weather block absent (tide-only comment)', () => {
    render(<ChecklistBadges flags={{ ...ALL_ABSENT, tideComment: true }} />)
    expect(screen.getByLabelText('Tide block in comment')).toBeTruthy()
    expect(screen.getByLabelText('No weather block in comment')).toBeTruthy()
  })

  it('combined weather+tide comment shows BOTH badges present', () => {
    render(<ChecklistBadges flags={{ ...ALL_ABSENT, weatherComment: true, tideComment: true }} />)
    expect(screen.getByLabelText('Weather block in comment')).toBeTruthy()
    expect(screen.getByLabelText('Tide block in comment')).toBeTruthy()
  })
})

describe('ChecklistBadges — state conveyed beyond color (NFR-04 / QA-16)', () => {
  it('title matches aria-label and differs between present and absent states', () => {
    const { rerender } = render(<ChecklistBadges flags={{ ...ALL_ABSENT, photo: true }} />)
    const present = screen.getByLabelText('Photos reported')
    // title attribute mirrors the label — a non-color, assistive-tech-readable signal.
    expect(present.getAttribute('title')).toBe('Photos reported')

    rerender(<ChecklistBadges flags={ALL_ABSENT} />)
    const absent = screen.getByLabelText('No photos reported')
    expect(absent.getAttribute('title')).toBe('No photos reported')
  })

  it('renders the type word as text alongside the icon (not color-only)', () => {
    render(<ChecklistBadges flags={ALL_PRESENT} />)
    // The present badge for photo carries the literal word "Photo".
    expect(screen.getByLabelText('Photos reported').textContent).toContain('Photo')
    expect(screen.getByLabelText('Breeding codes reported').textContent).toContain('Breeding')
  })
})

describe('ChecklistBadges — key-independent (QA-05)', () => {
  it('renders correctly from flags alone, with no keyStatus/transport involvement', () => {
    // The component takes only `flags`. If badges depended on keys/network it
    // could not be rendered in isolation like this — this render IS the proof
    // that the badge row is decoupled from key status (FR-08).
    const { container } = render(<ChecklistBadges flags={{ ...ALL_ABSENT, breeding: true, audio: true }} />)
    expect(container.querySelectorAll('span[aria-label]').length).toBe(6)
    expect(screen.getByLabelText('Breeding codes reported')).toBeTruthy()
    expect(screen.getByLabelText('Audio reported')).toBeTruthy()
  })
})
