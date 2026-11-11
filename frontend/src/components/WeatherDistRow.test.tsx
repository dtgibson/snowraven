// @vitest-environment jsdom
// The extracted distribution row's two defaulted props (hotspot-reports schema
// 8.1, item 3): with `share` supplied and `emphasis` omitted the row is the
// Statistics section's own (pinned byte for byte by WeatherDistRow.golden.test.tsx);
// each prop, supplied, changes only what it names.

import { describe, it, expect, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { DistRow } from './WeatherDistRow'

afterEach(cleanup)

const html = (el: React.ReactElement) => render(el).container.innerHTML

describe('DistRow', () => {
  it('with a share and no emphasis renders the section\'s row: figure, separator, share', () => {
    const out = html(<DistRow label="Clear" n={3} max={6} share="25%" />)
    expect(out).toBe(
      '<div class="sr-wx-row no-glyph"><span class="sr-wx-label">Clear</span>'
      + '<div class="sr-wx-track" aria-hidden="true"><span class="sr-wx-fill" style="--w: 50.00%;"></span></div>'
      + '<span class="sr-wx-count"><b>3</b> <span aria-hidden="true">\u00b7</span> 25%</span></div>',
    )
  })

  it('without a share prints the figure alone, and nothing else changes', () => {
    const withShare = html(<DistRow label="Jan" n={3} max={6} share="25%" />)
    cleanup()
    const countOnly = html(<DistRow label="Jan" n={3} max={6} />)
    expect(countOnly).toBe(withShare.replace(' <span aria-hidden="true">\u00b7</span> 25%', ''))
  })

  it('emphasis adds is-typical to the row and changes nothing else', () => {
    const plain = html(<DistRow label="Clear" n={3} max={6} share="25%" />)
    cleanup()
    const typical = html(<DistRow label="Clear" n={3} max={6} share="25%" emphasis />)
    expect(typical).toBe(plain.replace('class="sr-wx-row no-glyph"', 'class="sr-wx-row no-glyph is-typical"'))
  })

  it('a zero keeps its own shape: the dashed empty rail and the muted row', () => {
    const out = html(<DistRow label="Snow" n={0} max={6} share="0%" />)
    expect(out).toContain('sr-wx-row no-glyph is-zero')
    expect(out).toContain('sr-wx-track is-empty')
    expect(out).not.toContain('sr-wx-fill')
  })
})
