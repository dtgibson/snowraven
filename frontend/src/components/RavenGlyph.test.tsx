// @vitest-environment jsdom
/// <reference types="node" />
// custom-raven-glyph (v1.0.3): the brand mark component, its two render
// sites, and a source-scan guard that the generic lucide Bird icon never
// returns. The scan idiom follows entryChunk.test.ts (read real sources,
// exact identifier compare, never String.includes on a name).
import { describe, it, expect, afterEach, vi } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { RavenGlyph } from './RavenGlyph'
import { WelcomeScreen } from './WelcomeScreen'

afterEach(cleanup)

// Under the jsdom environment import.meta.url is not a file: URL, so resolve
// from the vitest root (frontend/) — the house idiom for jsdom source scans
// (MapExplorerSearchThisArea.test.tsx, sharePinReset.test.tsx). Fail loudly
// if that assumption ever breaks rather than scanning an empty tree.
const SRC = resolve(process.cwd(), 'src')
if (!existsSync(resolve(SRC, 'App.tsx'))) {
  throw new Error(`could not locate frontend/src from ${process.cwd()}`)
}
const RAVEN_VIEWBOX = '0 0 512 512'

// The raven is the only 512-viewBox svg on these surfaces (every lucide icon
// is 24); match on the exact attribute value, read per element (attribute
// selectors on SVG camelCase names are unreliable in jsdom).
function ravenSvgs(root: HTMLElement): SVGSVGElement[] {
  return Array.from(root.querySelectorAll('svg')).filter(
    (s) => s.getAttribute('viewBox') === RAVEN_VIEWBOX,
  )
}

describe('RavenGlyph component', () => {
  it('renders a decorative single-path currentColor svg in the 512 viewBox', () => {
    const { container } = render(<RavenGlyph size={30} />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute('aria-hidden')).toBe('true')
    expect(svg!.getAttribute('focusable')).toBe('false')
    expect(svg!.getAttribute('viewBox')).toBe(RAVEN_VIEWBOX)
    const paths = svg!.querySelectorAll('path')
    expect(paths.length).toBe(1)
    expect(paths[0].getAttribute('fill')).toBe('currentColor')
    // A filled silhouette carries no stroke geometry.
    expect(paths[0].getAttribute('stroke')).toBeNull()
  })

  it('the size prop drives both width and height (the three shipped sizes)', () => {
    for (const size of [20, 30, 34]) {
      const { container, unmount } = render(<RavenGlyph size={size} />)
      const svg = container.querySelector('svg')!
      expect(svg.getAttribute('width')).toBe(String(size))
      expect(svg.getAttribute('height')).toBe(String(size))
      unmount()
    }
  })

  it('passes the color token through style, exactly as the call sites use it', () => {
    const { container } = render(<RavenGlyph size={30} style={{ color: 'var(--sr-accent)' }} />)
    expect(container.querySelector('svg')!.style.color).toBe('var(--sr-accent)')
  })

  it('the component source carries no literal color value (token rule, ui.md)', () => {
    const source = readFileSync(resolve(SRC, 'components/RavenGlyph.tsx'), 'utf8')
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    expect(source).not.toMatch(/\brgba?\(/)
  })
})

describe('render sites', () => {
  it('WelcomeScreen renders the raven at 34, aria-hidden (the site that gains it)', () => {
    const { container } = render(
      <WelcomeScreen onGetStarted={vi.fn()} onOpenHelp={vi.fn()} onDismiss={vi.fn()} />,
    )
    const ravens = ravenSvgs(container)
    expect(ravens.length).toBe(1)
    expect(ravens[0].getAttribute('width')).toBe('34')
    expect(ravens[0].getAttribute('height')).toBe('34')
    expect(ravens[0].getAttribute('aria-hidden')).toBe('true')
    // Non-vacuity for the viewBox filter: the other lucide icons are still
    // mounted beside it, so the filter is discriminating among real svgs.
    expect(container.querySelectorAll('svg').length).toBeGreaterThan(1)
  })

  it('App.tsx wires the raven into the header at the approved sizes (source-level)', () => {
    // Mounting the whole App shell is out of scope for this file; the header
    // wiring is pinned at the source, entryChunk.test.ts already walks the
    // real import graph, and RavenGlyph itself is covered above.
    const app = readFileSync(resolve(SRC, 'App.tsx'), 'utf8')
    expect(app).toMatch(/import \{ RavenGlyph \} from '\.\/components\/RavenGlyph'/)
    expect(app).toMatch(/<RavenGlyph size=\{compactChrome\(\) \? 20 : 30\}/)
    const welcome = readFileSync(resolve(SRC, 'components/WelcomeScreen.tsx'), 'utf8')
    expect(welcome).toMatch(/import \{ RavenGlyph \} from '\.\/RavenGlyph'/)
    expect(welcome).toMatch(/<RavenGlyph size=\{34\}/)
  })
})

// ---------------------------------------------------------------------------
// Source-scan guard: no file under frontend/src imports the lucide Bird icon.

// Named imports from the lucide-react module in a source text: exact
// identifiers, alias-aware ("Settings as SettingsIcon" yields "Settings").
function lucideImportNames(code: string): string[] {
  const re = /import\s*(?:type\s+)?\{([^}]*)\}\s*from\s*['"]lucide-react['"]/g
  const names: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(code)) !== null) {
    for (const raw of m[1].split(',')) {
      const name = raw.trim().split(/\s+as\s+/)[0].trim()
      if (name) names.push(name)
    }
  }
  return names
}

function walkTsFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) walkTsFiles(p, out)
    else if (/\.tsx?$/.test(entry.name)) out.push(p)
  }
  return out
}

describe('no lucide Bird import remains anywhere under src', () => {
  it('parser red-check: it does find a Bird import when one exists', () => {
    // Fixture built by concatenation so this file's own raw source never
    // contains a matching import statement for the scan below to flag.
    const fixture = ['import { Bird, Search }', "from 'lucide-react'"].join(' ')
    expect(lucideImportNames(fixture)).toEqual(['Bird', 'Search'])
    const multiline = ['import {\n  Bird,\n  Check as Tick,\n}', "from 'lucide-react'"].join('\n')
    expect(lucideImportNames(multiline)).toEqual(['Bird', 'Check'])
    // A local module named after birds is not a lucide import.
    expect(lucideImportNames("import { BirdName } from './BirdName'")).toEqual([])
  })

  it('every lucide-react import list is Bird-free (exact identifier compare)', () => {
    const files = walkTsFiles(SRC)
    const importers: string[] = []
    const offenders: string[] = []
    for (const file of files) {
      const names = lucideImportNames(readFileSync(file, 'utf8'))
      if (names.length > 0) importers.push(file)
      if (names.some((n) => n === 'Bird')) offenders.push(file)
    }
    expect(offenders).toEqual([])
    // Non-vacuity: the scan really visited the tree and really parses lucide
    // imports — both former Bird sites still import their other lucide icons.
    const norm = importers.map((f) => f.replace(/\\/g, '/'))
    expect(norm.some((f) => f.endsWith('/App.tsx'))).toBe(true)
    expect(norm.some((f) => f.endsWith('/components/WelcomeScreen.tsx'))).toBe(true)
    expect(importers.length).toBeGreaterThan(10)
  })
})
