// Stylesheet guard for the Named Birds timelines, parsed from the REAL
// globals.css (vitest stubs CSS `?raw` imports, so it is read with `fs`, the
// milestoneContrast / countyContrast / calendarContrast posture).
//
// WHAT A PARSED STYLESHEET CANNOT SETTLE, said here so this file's greenness is
// not over-read: whether a rule WINS against the inline styles it sits beside,
// and any geometric claim at 320px or 200% text scale. Those are real-browser
// measurements against the production build. What this file does settle is that
// the declarations exist, are scoped to this feature's own `.sr-nbt-*` prefix,
// carry the geometry the design specifies, introduce no page-scroll `min-width`,
// and reference only tokens declared in BOTH themes.

/// <reference types="node" />
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../globals.css', import.meta.url), 'utf8')

/** Strip comments before any scan, so a rule described in prose is never matched. */
const stripComments = (s: string): string => s.replace(/\/\*[\s\S]*?\*\//g, '')
const clean = stripComments(css)

/** Every `selector { body }` pair in the file, at any nesting depth. */
function rules(source: string): Array<{ selector: string; body: string }> {
  const out: Array<{ selector: string; body: string }> = []
  const re = /([^{}]+)\{([^{}]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source)) !== null) {
    const selector = m[1].trim().replace(/\s+/g, ' ')
    if (selector.startsWith('@') || selector === '') continue
    out.push({ selector, body: m[2] })
  }
  return out
}

const ALL = rules(clean)
/** Every rule this feature adds, identified by its own class prefix. */
const NBT = ALL.filter(r => r.selector.includes('.sr-nbt-'))

const decl = (body: string, prop: string): string | null => {
  const m = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`, 'i').exec(body)
  return m ? m[1].trim() : null
}
const ruleFor = (selector: string) => NBT.find(r => r.selector === selector)

/** The established phone tier: the file's FIRST multi-line 640px block. */
function phoneTier(): string {
  const re = /@media \(max-width: 640px\) \{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(clean)) !== null) {
    let depth = 1
    let i = m.index + m[0].length
    while (i < clean.length && depth > 0) {
      if (clean[i] === '{') depth += 1
      else if (clean[i] === '}') depth -= 1
      i += 1
    }
    const block = clean.slice(m.index + m[0].length, i - 1)
    if (block.includes('\n') && block.split('\n').length > 3) return block   // multi-line
  }
  throw new Error('the established phone tier was not found')
}
const PHONE = phoneTier()

describe('the feature has named selectors to parse (non-vacuity)', () => {
  it('every rule it adds carries the .sr-nbt-* prefix and there are enough of them', () => {
    expect(NBT.length).toBeGreaterThan(15)
    // A rule added under any other prefix would be invisible to every assertion
    // below, so the prefix is the thing that makes this file possible.
    for (const r of NBT) {
      for (const part of r.selector.split(',')) {
        expect(part.trim(), `${r.selector} must be scoped to this feature`).toMatch(/\.sr-nbt-/)
      }
    }
  })
})

describe('every selector names what it targets', () => {
  it('no rule ends in a POSITIONAL or universal compound, which would compete bundle-wide', () => {
    // A selector's rightmost compound decides which elements it competes with,
    // and an ancestor part of a descendant combinator can always be satisfied —
    // which is why the shipped cascade-competitor scan tests the rightmost
    // compound alone. `.sr-nbt-mends > :first-child` therefore competed for
    // `display` with EVERY first child in the bundle and turned
    // `mapFabCascade.test.ts` red; the repair was a named hook
    // (`.sr-nbt-mendspacer`), not a weaker guard. This keeps the next one inside
    // this feature's own suite.
    const offenders: string[] = []
    for (const r of NBT) {
      for (const part of r.selector.split(',')) {
        const rightmost = part.trim().split(/\s+|>|\+|~/).filter(Boolean).pop() ?? ''
        if (rightmost === '*' || rightmost.startsWith(':')) offenders.push(part.trim())
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('geometry: every strip height is a PX value (the rem-in-a-px-box trap)', () => {
  // `.claude/rules/ui.md` records the Named Birds card map as the named example
  // of exactly this trap on exactly this surface: a rem value inside a fixed-px
  // box grows when the box does not, and at 200% in-app text scale it doubles.
  const EXPECTED: ReadonlyArray<[string, string, string]> = [
    ['.sr-nbt-track', 'height', '38px'],
    ['.sr-nbt-track', 'padding', '0 2px'],
    ['.sr-nbt-lanetrack', 'height', '24px'],
    ['.sr-nbt-lanetrack', 'padding', '0 2px'],
    ['.sr-nbt-tick', 'width', '3px'],
    ['.sr-nbt-tick', 'height', '22px'],
    ['.sr-nbt-tick.is-on', 'width', '5px'],
    ['.sr-nbt-tick.is-on', 'height', '28px'],
    ['.sr-nbt-lanetrack .sr-nbt-tick', 'height', '12px'],
    ['.sr-nbt-lanetrack .sr-nbt-tick.is-on', 'height', '18px'],
  ]

  it.each(EXPECTED)('%s declares %s: %s', (selector, prop, value) => {
    const r = ruleFor(selector)
    expect(r, `${selector} not found`).toBeTruthy()
    expect(decl(r!.body, prop)).toBe(value)
  })

  it('the lane track grows to 30px in the phone tier, so a lane clears the 24px minimum', () => {
    const tier = rules(PHONE).find(r => r.selector === '.sr-nbt-lanetrack')
    expect(tier, 'the phone-tier lane-track rule must live in the ESTABLISHED 640 block').toBeTruthy()
    expect(decl(tier!.body, 'height')).toBe('30px')
  })

  it('the RAIL INSET is half a mark, so a mark at 0% and at 100% sits fully inside the track', () => {
    for (const s of ['.sr-nbt-track', '.sr-nbt-lanetrack']) {
      expect(decl(ruleFor(s)!.body, 'padding')).toBe('0 2px')   // 2px = half of a 3px mark
    }
    expect(decl(ruleFor('.sr-nbt-tick')!.body, 'margin-left')).toBe('-1.5px')
  })

  it('every text-sized element sits OUTSIDE a fixed-px box', () => {
    // Each of these carries a rem font-size, so none of them may also carry a px
    // height: the labels, the axis dates and both readout lines live in normal
    // flow beside a track, never inside one.
    for (const s of ['.sr-nbt-ends', '.sr-nbt-readout', '.sr-nbt-lanelabel', '.sr-nbt-cap', '.sr-nbt-sentence', '.sr-nbt-scope', '.sr-nbt-oneday']) {
      const r = ruleFor(s)
      expect(r, `${s} not found`).toBeTruthy()
      expect(decl(r!.body, 'font-size'), `${s} should be sized in rem`).toMatch(/rem$/)
      expect(decl(r!.body, 'height'), `${s} must not sit in a fixed-px box`).toBeNull()
    }
  })
})

describe('no rule this feature adds can force page horizontal scroll', () => {
  it('sets no POSITIVE min-width anywhere, in any tier', () => {
    const offenders: string[] = []
    for (const r of ALL) {
      if (!r.selector.includes('.sr-nbt-')) continue
      const v = decl(r.body, 'min-width')
      if (v !== null && v !== '0' && v !== '0px') offenders.push(`${r.selector} { min-width: ${v} }`)
    }
    expect(offenders).toEqual([])
    // Non-vacuity: the feature DOES set `min-width: 0` where a grid or flex child
    // needs its automatic minimum released, so the scan really is finding rules.
    expect(ALL.filter(r => r.selector.includes('.sr-nbt-') && decl(r.body, 'min-width') === '0').length)
      .toBeGreaterThan(0)
  })

  it('the master lane grid uses self-collapsing minmax tracks rather than a fixed column', () => {
    expect(decl(ruleFor('.sr-nbt-lane')!.body, 'grid-template-columns')).toBe('minmax(0, 34%) minmax(0, 1fr)')
    const tier = rules(PHONE).find(r => r.selector === '.sr-nbt-lane')
    expect(decl(tier!.body, 'grid-template-columns')).toBe('minmax(0, 1fr)')
  })

  it('the 120-character lane label WRAPS and carries no nowrap', () => {
    const r = ruleFor('.sr-nbt-lanelabel')!
    expect(decl(r.body, 'overflow-wrap')).toBe('anywhere')
    expect(decl(r.body, 'white-space')).toBeNull()
    expect(decl(r.body, 'min-width')).toBe('0')
  })

  it('the axis end labels are a 1fr auto GRID, so the right label stays right-aligned when it wraps', () => {
    expect(decl(ruleFor('.sr-nbt-ends')!.body, 'grid-template-columns')).toBe('1fr auto')
    expect(decl(ruleFor('.sr-nbt-ends span:last-child')!.body, 'text-align')).toBe('right')
  })
})

describe('colour: tokens only, declared in BOTH themes', () => {
  const rootBlock = (): string => {
    const i = clean.indexOf(':root {')
    return clean.slice(i, clean.indexOf('\n}', i))
  }
  const darkBlock = (): string => {
    const i = clean.indexOf('[data-theme="dark"] {')
    return clean.slice(i, clean.indexOf('\n}', i))
  }
  const ROOT = rootBlock()
  const DARK = darkBlock()

  it('references no hardcoded hex, rgb() or rgba() literal', () => {
    for (const r of NBT) {
      expect(r.body, `${r.selector}`).not.toMatch(/#[0-9A-Fa-f]{3,8}\b/)
      expect(r.body, `${r.selector}`).not.toMatch(/\brgba?\(/)
    }
  })

  it('every --sr-* token it uses is declared in BOTH :root and [data-theme="dark"]', () => {
    const used = new Set<string>()
    for (const r of NBT) for (const m of r.body.matchAll(/var\((--sr-[a-z0-9-]+)/g)) used.add(m[1])
    expect(used.size).toBeGreaterThan(4)
    for (const token of used) {
      expect(ROOT, `${token} missing from :root`).toContain(`${token}:`)
      expect(DARK, `${token} missing from [data-theme="dark"]`).toContain(`${token}:`)
    }
  })

  it('uses NO categorical chart token: the strip at the bottom is monochrome by decision', () => {
    // Four distinguishable colours plus slate would give three named birds a
    // colour each and twenty birds four colours and sixteen slate lanes, implying
    // a grouping that does not exist; and graph-photo / -audio / -video already
    // mean photo, audio and video on a tab where every expanded card carries a
    // media section. Identity is the lane label, extent is the span line.
    const CATEGORICAL = ['--sr-graph-photo', '--sr-graph-audio', '--sr-graph-video', '--sr-chart-slate']
    for (const r of NBT) for (const t of CATEGORICAL) expect(r.body, `${r.selector}`).not.toContain(t)
  })
})

describe('mark-versus-rail contrast clears WCAG 1.4.11 in both themes', () => {
  const block = (selector: string): string => {
    const i = clean.indexOf(selector)
    return clean.slice(i, clean.indexOf('\n}', i))
  }
  const ROOT = block(':root {')
  const DARK = block('[data-theme="dark"] {')
  const hexOf = (where: string, name: string): string => {
    const m = new RegExp(`${name}:\\s*(#[0-9A-Fa-f]{6})`).exec(where)
    if (!m) throw new Error(`token ${name} not found`)
    return m[1]
  }
  const srgb = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
  const lum = (hex: string) => {
    const h = hex.replace('#', '')
    return 0.2126 * srgb(parseInt(h.slice(0, 2), 16))
      + 0.7152 * srgb(parseInt(h.slice(2, 4), 16))
      + 0.0722 * srgb(parseInt(h.slice(4, 6), 16))
  }
  const contrast = (a: string, b: string) => {
    const la = lum(a); const lb = lum(b)
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
  }

  it('--sr-accent on --sr-border-medium is at least 3:1 in BOTH themes', () => {
    // THE GUARDED PAIR IS MARK VERSUS RAIL, because a mark sits on the rail
    // wherever a bird has a span. Light is the tight one and is what this
    // protects; mutating either token below the threshold turns it red.
    for (const [name, b] of [['light', ROOT], ['dark', DARK]] as const) {
      const c = contrast(hexOf(b, '--sr-accent'), hexOf(b, '--sr-border-medium'))
      expect(c, `mark on rail, ${name}: ${c.toFixed(2)}:1`).toBeGreaterThanOrEqual(3)
    }
  })

  it('the rail against its host surface is DELIBERATELY unguarded, and this records why', () => {
    // ~1.66:1 in both themes by design: it is a hairline guide, not a state
    // carrier, and a 3:1 rule there would read as a divider. Asserted so a future
    // reader meets the decision rather than the number.
    const light = contrast(hexOf(ROOT, '--sr-border-medium'), hexOf(ROOT, '--sr-surface-faint'))
    expect(light).toBeLessThan(3)
    expect(light).toBeGreaterThan(1.2)
  })

  it('the active mark\'s halo is the HOST surface token, so it punches a gap rather than adding a colour', () => {
    expect(ruleFor('.sr-nbt-tick.is-on')!.body).toContain('var(--sr-surface-faint)')
    expect(ruleFor('.sr-nbt-lanetrack .sr-nbt-tick.is-on')!.body).toContain('var(--sr-surface-subtle)')
    expect(ruleFor('.sr-nbt-lane.is-on')!.body).toContain('var(--sr-surface-subtle)')
  })
})

describe('motion', () => {
  it('adds NO animation, and no transition outside the shipped pill pattern', () => {
    // A range flip is a data change, not an entrance, and transitioning `left` on
    // a few hundred absolutely positioned elements is a layout-thrashing property
    // on exactly the phones and the Pi this app must stay smooth on. Selection is
    // instant on purpose: a transition would lag the pointer during a scrub.
    for (const r of NBT) {
      expect(decl(r.body, 'animation'), `${r.selector}`).toBeNull()
      expect(decl(r.body, 'transition'), `${r.selector}`).toBeNull()
    }
  })

  it('adds no per-component prefers-reduced-motion query, because the global block already covers it', () => {
    const blocks = clean.split('@media (prefers-reduced-motion: reduce)')
    for (const b of blocks.slice(1)) {
      const body = b.slice(0, b.indexOf('\n}\n') + 1)
      expect(body).not.toContain('.sr-nbt-')
    }
    // Non-vacuity: the global block really is there and really does collapse
    // every transition in the file.
    expect(clean).toContain('transition-duration: 0.001ms !important')
  })
})

describe('the one shipped declaration this feature changes', () => {
  it('the collapsed card\'s duration line has a class of its own and carries NO nowrap', () => {
    const r = ruleFor('.sr-nbt-durline')
    expect(r).toBeTruthy()
    expect(decl(r!.body, 'white-space')).toBeNull()
  })
})
