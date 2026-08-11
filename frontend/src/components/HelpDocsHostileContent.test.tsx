// @vitest-environment jsdom
//
// Drives the RENDERER with hostile Help content by mocking the ?raw import, so
// the gate's fallback path is exercised end to end rather than inferred from
// the predicate's unit tests.
//
// Why this file exists at all: without it, deleting the gate from HelpDocs.tsx
// leaves the ENTIRE suite green. lib/helpLinks.test.ts proves the predicate
// rejects hostile targets, and HelpDocs.test.tsx proves the seven real links
// survive — but nothing proved the renderer still consults the predicate,
// because docs/HELP.md holds no hostile target for a renderer test to catch.
// "The renderer stops calling the gate" is the most obvious form the defect
// could return in, so it has to be a form the suite rejects. Mocking the ?raw
// specifier gets there with no production change: the component keeps taking no
// content prop, which matters, since its whole safety argument is that its only
// input is a developer-controlled static file.
//
// It is a separate file because vi.mock is file-scoped, and HelpDocs.test.tsx
// must keep rendering the REAL docs/HELP.md to assert the shipped links.
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'

// Each row is a form the defect could actually return in: the scheme families a
// markdown href can smuggle, the whitespace/control-character tricks browsers
// strip before reading a scheme, protocol-relative, the `https:evil` form a
// looser predicate admits, and the structural edges (empty target, empty text,
// images). L/M/O must KEEP linking — a rejects-only fixture would pass just as
// happily on a renderer that had stopped emitting anchors at all.
const HOSTILE = [
  '# QA',
  '',
  '## Section',
  '',
  'A [click me](javascript:alert(1)) link.',
  '',
  'B [data link](data:text/html,<script>alert(1)</script>) link.',
  '',
  'C [vb](vbscript:msgbox(1)) link.',
  '',
  'D [upper](JaVaScRiPt:alert(1)) link.',
  '',
  'E [proto rel](//evil.example) link.',
  '',
  'F [opaque](https:evil) link.',
  '',
  'G [leading space]( javascript:alert(1)) link.',
  '',
  'H [tabbed](java\tscript:alert(1)) link.',
  '',
  'I [relative](/settings) link.',
  '',
  'J [empty]() link.',
  '',
  'K [](javascript:alert(1)) link.',
  '',
  'L [good](https://good.example) link.',
  '',
  'M [plain http](http://plain.example) link.',
  '',
  'N image ![a bird](javascript:alert(1)) here.',
  '',
  'O image ![logo](https://img.example/a.png) here.',
  '',
  // P is here because every other hostile row above stays green when the
  // predicate's `^` anchor is dropped: none of them embeds an http(s)
  // substring, so an unanchored `/https?:\/\//i` still rejects them all and
  // the renderer-level fixture reports a clean bill on a genuinely broken
  // guard. This row carries `https://` INSIDE a javascript: payload, which is
  // what an unanchored predicate would turn into a live javascript: anchor.
  'P [embedded](javascript:void("https://ok.example")) link.',
  '',
  // Q must KEEP linking. It is the positive-direction case: dropping the `i`
  // flag rejects a legitimate uppercase scheme and silently degrades a real
  // link to plain text, which no amount of hostile input can reveal.
  'Q [upper scheme](HTTPS://Ok.Example/x) link.',
  '',
].join('\n')

vi.mock('../../../docs/HELP.md?raw', () => ({ default: HOSTILE }))

const { HelpDocs } = await import('./HelpDocs')

const REJECTED_TEXTS = ['click me', 'data link', 'vb', 'upper', 'proto rel',
  'opaque', 'leading space', 'tabbed', 'relative', 'embedded']

describe('HelpDocs renderer, driven with hostile content (help-link-scheme-gate)', () => {
  it('emits anchors ONLY for the http(s) targets', () => {
    const { container } = render(<HelpDocs onClose={vi.fn()} />)
    const hrefs = Array.from(container.querySelectorAll('a')).map(a => a.getAttribute('href'))
    // The https IMAGE src legitimately becomes an anchor by this same path —
    // that is the design (one gate, one path), not a leak.
    expect(hrefs).toEqual([
      'https://good.example',
      'http://plain.example',
      'https://img.example/a.png',
      'HTTPS://Ok.Example/x',
    ])
  })

  it('keeps the link TEXT visible as plain text on a rejected target', () => {
    const { container } = render(<HelpDocs onClose={vi.fn()} />)
    const body = container.textContent ?? ''
    for (const t of REJECTED_TEXTS) {
      expect(body, `rejected link text should stay visible: ${t}`).toContain(t)
    }
    // Exact element matching, NOT a substring scan over a joined string. Row Q's
    // link text ("upper scheme") deliberately contains row D's ("upper"), which
    // a substring scan reports as a leak when nothing leaked. Keeping the near
    // collision in the fixture is what holds this assertion honest.
    const anchorTexts = Array.from(container.querySelectorAll('a')).map(a => a.textContent)
    for (const t of REJECTED_TEXTS) {
      expect(anchorTexts, `must not be a link: ${t}`).not.toContain(t)
    }
  })

  it('never echoes the raw markdown source as the fallback', () => {
    const { container } = render(<HelpDocs onClose={vi.fn()} />)
    const body = container.textContent ?? ''
    expect(body).not.toContain('javascript:')
    expect(body).not.toContain('data:text/html')
    expect(body).not.toContain('vbscript:')
    expect(body).not.toContain('//evil.example')
    expect(body).not.toContain('https:evil')
    expect(body).not.toContain('](')
    expect(container.querySelector('script')).toBeNull()
  })

  it('an empty-text rejected link vanishes entirely, leaving the surrounding prose intact', () => {
    const { container } = render(<HelpDocs onClose={vi.fn()} />)
    const body = container.textContent ?? ''
    // NOTE: the trailing ')' is PRE-EXISTING tokenizer behavior, unchanged by
    // this build: the token regex's target group is [^)]*, so it stops at the
    // first ')' and the outer one falls through as plain text. Verified
    // identical on the before-revision. The point here is that the empty link
    // TEXT contributes nothing at all.
    expect(body).toContain('K ) link.')
  })

  it('an image src reaches the SAME gate at the renderer level', () => {
    const { container } = render(<HelpDocs onClose={vi.fn()} />)
    const body = container.textContent ?? ''
    // The hostile image degrades: alt text survives, no anchor, no javascript:.
    expect(body).toContain('a bird')
    expect(Array.from(container.querySelectorAll('a')).map(a => a.textContent)).not.toContain('a bird')
    // The https image DOES become an anchor by this same path, which proves the
    // path is live rather than that images are separately handled.
    expect(container.querySelector('a[href="https://img.example/a.png"]')).toBeTruthy()
  })

  it('renders no javascript:/data: href anywhere in the document', () => {
    const { container } = render(<HelpDocs onClose={vi.fn()} />)
    for (const a of Array.from(container.querySelectorAll('a'))) {
      expect(a.getAttribute('href')).toMatch(/^https?:\/\//i)
    }
  })
})
