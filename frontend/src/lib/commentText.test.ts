import { describe, it, expect } from 'vitest'
import { decodeEntities, linkify, commentSegments, hasComment } from './commentText'

describe('decodeEntities', () => {
  it('decodes numeric hex and decimal entities', () => {
    expect(decodeEntities('&#x2600;')).toBe('☀')   // ☀
    expect(decodeEntities('&#65;')).toBe('A')
  })
  it('decodes common named entities', () => {
    expect(decodeEntities('a &amp; b &lt;c&gt; &quot;d&quot;')).toBe('a & b <c> "d"')
  })
  it('leaves plain text and unknown entities intact', () => {
    expect(decodeEntities('just text')).toBe('just text')
    expect(decodeEntities('&unknown;')).toBe('&unknown;')
  })
  it('handles empty input', () => {
    expect(decodeEntities('')).toBe('')
  })
  it('rejects out-of-range code points gracefully', () => {
    expect(decodeEntities('&#xFFFFFFFF;')).toBe('')
  })
})

describe('linkify', () => {
  it('splits a URL into a link segment', () => {
    const segs = linkify('see https://ebird.org/checklist/S123 here')
    expect(segs).toEqual([
      { text: 'see ' },
      { text: 'https://ebird.org/checklist/S123', href: 'https://ebird.org/checklist/S123' },
      { text: ' here' },
    ])
  })
  it('does not swallow trailing punctuation into the link', () => {
    const segs = linkify('look (https://example.com/x).')
    const link = segs.find(s => s.href)
    expect(link?.href).toBe('https://example.com/x')
    // the ")." stays as plain text
    expect(segs.map(s => s.text).join('')).toBe('look (https://example.com/x).')
  })
  it('only linkifies http/https (no javascript: or other schemes)', () => {
    const segs = linkify('javascript:alert(1) and ftp://x and data:text/html,x')
    expect(segs.every(s => !s.href)).toBe(true)
  })
  it('returns plain text with no links', () => {
    expect(linkify('no links here')).toEqual([{ text: 'no links here' }])
  })
})

describe('commentSegments', () => {
  it('decodes then linkifies', () => {
    const segs = commentSegments('a &amp; b https://x.com')
    expect(segs[0].text).toBe('a & b ')
    expect(segs[1]).toEqual({ text: 'https://x.com', href: 'https://x.com' })
  })
})

describe('hasComment', () => {
  it('true only when there is decoded content', () => {
    expect(hasComment('hi')).toBe(true)
    expect(hasComment('')).toBe(false)
    expect(hasComment(null)).toBe(false)
    expect(hasComment('   ')).toBe(false)
    expect(hasComment('\r\n')).toBe(false)
  })
})
