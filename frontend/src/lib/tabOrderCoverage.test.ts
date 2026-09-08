// feature: shared-button-link-primitives — every app-owned button and href link
// renders through the native Button/Link seams, which supply tabIndex={0} by
// default. Deliberately non-default call sites stay explicit and counted in the
// authoritative roster below.
//
// WHY THIS FILE EXISTS. WebKit's default tab mode (Safari with macOS "Keyboard
// navigation" off, which is the default and what WKWebView follows, so it is
// what the shipped Mac, iPhone and iPad apps get) visits only
// explicitly-tabindexed elements, native form controls and <summary>. A plain
// <button> and a plain <a href> are skipped ENTIRELY. The measurement is written
// up in lib/useFocusTrap.ts's header and in DECISIONS.md (v1.0.15). So on those
// three platforms an unmarked control is not "hard to reach" — it is not
// reachable by keyboard at all, wherever in the app it sits.
//
// THE PROPERTY ASSERTED, and why it is a property rather than a count: every
// app-owned control call site uses the canonical primitive, every ordinary call
// inherits its tab stop, and every override is in the EXCLUSIONS roster below.
// Raw <button> and <a href> elements are permitted only in the primitive files.
// A count ("248 of 248") would go stale with the next control; the property does
// not. ACCESSIBILITY.md publishes the same ownership model in prose.
//
// WHY AN AST WALK, NOT A REGEX. Nearly every one of these JSX openings spans
// several lines and contains `>` inside expression braces (style={{...}},
// onMouseEnter={e => ...}), so neither <button[^>]*> nor a line-based toContain
// can associate a tabIndex with its own tag. An AST walk is also COMMENT-IMMUNE
// by construction — {/* ... */} parses as an empty JSX expression container, so
// a <button> written inside a source comment is not an element at all. That is
// not a hypothetical: a commented-out `<button aria-label="Close popup">` in
// BirdingStats.tsx is what made three scan passes disagree on the population
// during v1.0.16. This satisfies .claude/rules/testing.md's comment-stripping
// requirement structurally rather than by filter.
//
// WHY THIS GUARD, the primitive render tests, and
// components/mapCornerTabStops.test.tsx ALL EXIST — none subsumes another:
//   * THIS file reads SOURCE. It sees every shipped .tsx file in the tree,
//     including ones no test mounts, so a raw-control bypass or unrostered
//     override fails without anyone remembering to add a component test. It
//     also pins the primitives' source defaults. It cannot prove ref/prop
//     forwarding or the rendered native attributes.
//   * components/ui/ButtonLink.test.tsx renders the two seams and proves their
//     defaults, overrides, refs, native props, class/style, and native semantics.
//   * THAT file reads the RENDERED DOM of the map corner controls, so it catches
//     a regression in the composed map surfaces. What it cannot see is a file
//     nobody mounted, which is most of the app.
//
// WHAT NEITHER CAN PROVE, and neither is evidence for: that WebKit's real tab
// order reaches these controls. jsdom has no tab order at all
// (.claude/rules/ui.md says so outright), and this file does not even render.
// The attribute IS the property that makes the engine's order irrelevant, so the
// attribute is what is asserted. The engine-level claim is a browser
// measurement, written up in
// pipeline/webkit-tab-order-app-wide/pr-description.md.

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, normalize } from 'node:path/posix'
import ts from 'typescript'

const SRC = fileURLToPath(new URL('../', import.meta.url)) // frontend/src/
const REPO = fileURLToPath(new URL('../../../', import.meta.url))

/**
 * Every SHIPPED .tsx under src/, relative to src/. Walked rather than listed:
 * naming the files is precisely the assumption this guard exists to remove.
 */
const shippedComponents = (): string[] => {
  const found: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(`${SRC}${dir}`, { withFileTypes: true })) {
      if (entry.isDirectory()) { walk(`${dir}${entry.name}/`); continue }
      if (!entry.name.endsWith('.tsx') || entry.name.endsWith('.test.tsx')) continue
      found.push(`${dir}${entry.name}`)
    }
  }
  walk('')
  return found.sort()
}

type ControlKind = 'button' | 'link'
type Site = {
  file: string
  line: number
  tag: string
  kind: ControlKind
  tabIndex: string | null
  source: 'primitive' | 'raw'
}

const PRIMITIVES = {
  button: { file: 'components/ui/Button.tsx', exportName: 'Button', nativeTag: 'button' },
  link: { file: 'components/ui/Link.tsx', exportName: 'Link', nativeTag: 'a' },
} as const satisfies Record<ControlKind, { file: string; exportName: string; nativeTag: string }>

const resolvedImport = (relPath: string, specifier: string): string | null => {
  if (!specifier.startsWith('.')) return null
  const path = normalize(join(dirname(relPath), specifier))
  return path.endsWith('.tsx') ? path : `${path}.tsx`
}

/** Canonical primitive imports, local aliases included. */
const primitiveBindings = (sf: ts.SourceFile, relPath: string): Map<string, ControlKind> => {
  const found = new Map<string, ControlKind>()
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
    const importedFile = resolvedImport(relPath, statement.moduleSpecifier.text)
    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue
    for (const binding of bindings.elements) {
      const importedName = (binding.propertyName ?? binding.name).text
      const kind = (Object.keys(PRIMITIVES) as ControlKind[])
        .find(candidate => PRIMITIVES[candidate].file === importedFile && PRIMITIVES[candidate].exportName === importedName)
      if (kind) found.set(binding.name.text, kind)
    }
  }
  return found
}

/**
 * Every canonical primitive call and every raw intrinsic control in one file,
 * with the SOURCE TEXT of its own tabIndex initializer (null when absent).
 *
 * A tabIndex arriving through {...spread} does not count as explicit here. That
 * is deliberate and it is the stricter reading: the spread's contents are not
 * knowable from this element, so a guard that accepted one would pass an element
 * whose attribute may never materialise.
 */
const sitesIn = (relPath: string): Site[] => {
  const text = readFileSync(`${SRC}${relPath}`, 'utf8')
  const sf = ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const bindings = primitiveBindings(sf, relPath)
  const out: Site[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sf)
      const boundKind = bindings.get(tag)
      if (tag === 'button' || tag === 'a' || boundKind) {
        let hasHref = false
        let tabIndex: string | null = null
        for (const attr of node.attributes.properties) {
          if (ts.isJsxSpreadAttribute(attr)) continue
          const name = attr.name.getText(sf)
          if (name === 'href') hasHref = true
          if (name === 'tabIndex') tabIndex = attr.initializer ? attr.initializer.getText(sf) : '(bare)'
        }
        const rawKind: ControlKind | null = tag === 'button'
          ? 'button'
          : tag === 'a' && (hasHref || relPath === PRIMITIVES.link.file)
            ? 'link'
            : null
        const kind = boundKind ?? rawKind
        if (kind) {
          out.push({
            file: relPath,
            line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
            tag,
            kind,
            tabIndex,
            source: boundKind ? 'primitive' : 'raw',
          })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

const scannedSites = (): Site[] => shippedComponents().flatMap(sitesIn)
const allSites = (): Site[] => scannedSites().filter(site => site.source === 'primitive')
const rawSites = (): Site[] => scannedSites().filter(site => site.source === 'raw')

/** The source default owned by one primitive's `tabIndex = 0` binding. */
const tabIndexDefaultsIn = (relPath: string): string[] => {
  const text = readFileSync(`${SRC}${relPath}`, 'utf8')
  const sf = ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const found: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isBindingElement(node) && node.name.getText(sf) === 'tabIndex' && node.initializer) {
      found.push(node.initializer.getText(sf))
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return found
}

/**
 * The ONLY primitive call sites permitted to override the inherited tabIndex=0.
 *
 * Blanket-marking these breaks arrow-key navigation, or re-adds a control the
 * platform deliberately removed, so this roster is the regression risk in this
 * feature rather than an afterthought.
 *
 * THEY ARE NOT ALL ONE KIND, and saying so matters, because the prose that
 * publishes them has to be true of EACH:
 *   - Roving-tabindex groups let the container hold one tab stop while arrow
 *     keys move within it. The main navigation's vertical tablist and the
 *     Settings choice rows use this pattern. ACCESSIBILITY.md describes the
 *     behavior under Keyboard Navigation; it does not mirror this roster's
 *     cardinality.
 *   - The species selector's redundant chevron is NOT roving: it has a fixed
 *     tabIndex={-1}, and the arrow keys never move to it.
 *     They move an aria-activedescendant index on the <input> beside it, which
 *     is itself a tab stop whose onFocus opens the same list. It is skipped
 *     because something else already does its job, not because a group owns its
 *     stop.
 *   - The offline base-map button is not a tab-order decision at all. It
 *     carries native `disabled`, so the platform removes it whatever its
 *     tabIndex says. ACCESSIBILITY.md publishes that under OFFLINE STATES,
 *     deliberately apart from the redundant-control exceptions, because
 *     "another tab stop already reaches it" is not the reason.
 * Collapsing the roster into one kind of exception is false. Non-owner prose
 * therefore states the property and points here instead of restating a total.
 *
 * BINDING. Each row declares the exact NUMBER of sites it covers, and the tests
 * assert equality rather than existence. Without the count a row is a blanket
 * pardon for its whole file: a second unmarked control added to an
 * already-rostered file matched an existing row and passed silently, which a
 * reviewer demonstrated against the previous revision. Keyed by file plus
 * initializer plus count rather than by line number, so a row survives an
 * unrelated edit above it, while a change of policy AT the site, or a new
 * unmarked sibling BESIDE it, does not.
 *
 * NOT here, and not an omission: SnowMap.tsx's Trails checkbox, which the
 * bug-brief listed alongside the base-map button. It is an <input>, so it is
 * outside this guard's population by ELEMENT TYPE, and a native form control is
 * a tab stop even under WebKit's default mode, so it never needed marking.
 */
const EXCLUSIONS: ReadonlyArray<{ file: string; tabIndex: string; count: number; why: string }> = [
  {
    file: 'components/TabNav.tsx',
    tabIndex: '{active ? 0 : -1}',
    count: 1,
    why: 'roving group: role="tab" in the main navigation\'s VERTICAL tablist (aria-orientation="vertical"), so the tablist holds one stop and ArrowUp/ArrowDown move between destinations. The nav\'s other controls — the collapse toggle, the five bottom-bar cells, every More-sheet row — are ordinary Button calls inheriting tabIndex=0 and are deliberately NOT here',
  },
  {
    file: 'components/Settings.tsx',
    tabIndex: '{checked ? 0 : -1}',
    count: 1,
    why: 'roving group: role="radio" in the Color theme / Text size / Date format RadioGroups',
  },
  {
    file: 'components/SpeciesCombobox.tsx',
    tabIndex: '{-1}',
    count: 1,
    why: 'NOT roving: the list-toggle chevron, which the arrow keys never reach. The role="combobox" <input> beside it is a native form control (a tab stop even under WebKit\'s default) whose onFocus opens the same list',
  },
  {
    file: 'components/SnowMap.tsx',
    tabIndex: '{rasterOffline ? -1 : 0}',
    count: 1,
    why: 'NOT a tab-order decision: the base-map button pairs this with native disabled, so the platform removes it regardless. ACCESSIBILITY.md\'s Offline States publishes exactly this',
  },
]

const isExcluded = (site: Site): boolean =>
  EXCLUSIONS.some(e => e.file === site.file && e.tabIndex === site.tabIndex)

/** `file|tabIndex` for one site: the key both the roster and the tree are counted by. */
const countKey = (file: string, tabIndex: string | null): string =>
  `${file}|${tabIndex ?? '(absent)'}`

describe('every control the app renders itself is an explicit tab stop', () => {
  it('finds the population at all (the guard is not silently scanning nothing)', () => {
    const files = shippedComponents()
    expect(files.length).toBeGreaterThan(60)
    const sites = allSites()
    expect(sites.filter(s => s.kind === 'button').length).toBeGreaterThan(150)
    expect(sites.filter(s => s.kind === 'link').length).toBeGreaterThan(10)
  })

  it('raw intrinsic controls exist only as the one native element inside each primitive', () => {
    expect(rawSites().map(s => `${s.file}:${s.kind}:${s.tabIndex}`)).toEqual([
      'components/ui/Button.tsx:button:{tabIndex}',
      'components/ui/Link.tsx:link:{tabIndex}',
    ])
  })

  it('both primitives own a literal tabIndex = 0 source default', () => {
    expect(tabIndexDefaultsIn(PRIMITIVES.button.file)).toEqual(['0'])
    expect(tabIndexDefaultsIn(PRIMITIVES.link.file)).toEqual(['0'])
  })

  it('ordinary primitive calls inherit the default; only rostered sites override it', () => {
    const offenders = allSites()
      .filter(s => s.tabIndex !== null)
      .filter(s => !isExcluded(s))
      .map(s => `${s.file}:${s.line}  <${s.tag}>  tabIndex=${s.tabIndex}`)

    // A default-valued override is still an offender: ordinary sites inherit
    // through the primitive, so ownership cannot drift back to call sites.
    expect(offenders).toEqual([])
  })

  it('every EXCLUSIONS row covers EXACTLY the number of sites it claims', () => {
    // Equality, not existence. `toBeGreaterThan(0)` made each row a blanket
    // pardon for its whole file, so a SECOND unmarked control added beside an
    // already-rostered one was silently absorbed. Counting binds each row to its
    // own site without pinning a line number that an unrelated edit above would
    // move.
    const sites = allSites()
    for (const e of EXCLUSIONS) {
      const matches = sites.filter(s => s.file === e.file && s.tabIndex === e.tabIndex)
      expect(
        matches.length,
        `EXCLUSIONS row out of date: ${e.file} tabIndex=${e.tabIndex} claims ${e.count} site(s), found ${matches.length}. (${e.why})`,
      ).toBe(e.count)
    }
  })

  it('the roster accounts for every explicit override exactly once', () => {
    // Compared as a COUNTED multiset rather than a de-duplicated set: a set
    // collapses sites sharing a file and initializer into one entry, which is
    // the exact hole the per-row counts above exist to close. ACCESSIBILITY.md
    // publishes the property and exception shapes without mirroring this total.
    const overrides = allSites().filter(s => s.tabIndex !== null)
    expect(overrides.every(isExcluded)).toBe(true)

    const found = new Map<string, number>()
    for (const s of overrides) {
      const k = countKey(s.file, s.tabIndex)
      found.set(k, (found.get(k) ?? 0) + 1)
    }
    const expected = new Map(EXCLUSIONS.map(e => [countKey(e.file, e.tabIndex), e.count]))
    expect(Object.fromEntries([...found].sort())).toEqual(Object.fromEntries([...expected].sort()))
    expect(overrides.length).toBe(EXCLUSIONS.reduce((n, e) => n + e.count, 0))
  })

  it('keeps roster totals out of the explanatory source and published prose', () => {
    const narratives = [
      readFileSync(`${SRC}lib/tabOrderCoverage.test.ts`, 'utf8'),
      readFileSync(`${SRC}lib/useFocusTrap.ts`, 'utf8'),
      readFileSync(`${REPO}.claude/rules/ui.md`, 'utf8'),
      readFileSync(`${REPO}ACCESSIBILITY.md`, 'utf8'),
    ]
    const staleTotalClaims = [
      /\b(?:one|two|three|four|five|\d+) deliberately non-default call sites?\b/i,
      /\b(?:one|two|three|four|five|\d+) rostered exceptions?\b/i,
      /\b(?:one|two|three|four|five|\d+) (?:are|were) roving-tabindex groups?\b/i,
      /\bthis app has (?:one|two|three|four|five|\d+) such groups?\b/i,
      /\broster (?:went|goes) from (?:one|two|three|four|five|\d+) rows? to (?:one|two|three|four|five|\d+)\b/i,
      /\bthat is the whole of the list\b/i,
      /\b(?:one|two|three|four|five) of those (?:are|is)\b/i,
    ]

    for (const narrative of narratives) {
      for (const claim of staleTotalClaims) expect(narrative).not.toMatch(claim)
    }
  })
})

describe('the scan itself behaves as claimed (mutation checks)', () => {
  // These run the analyser over source strings rather than over the tree, so a
  // failure points at the ANALYSER, not at a component. A guard whose scanner is
  // broken passes everything, which is the failure mode worth buying against.
  const analyse = (src: string): Site[] => {
    const relPath = 'components/Probe.tsx'
    const sf = ts.createSourceFile(relPath, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const bindings = primitiveBindings(sf, relPath)
    const out: Site[] = []
    const visit = (node: ts.Node): void => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(sf)
        const boundKind = bindings.get(tag)
        let hasHref = false
        let tabIndex: string | null = null
        for (const attr of node.attributes.properties) {
          if (ts.isJsxSpreadAttribute(attr)) continue
          const name = attr.name.getText(sf)
          if (name === 'href') hasHref = true
          if (name === 'tabIndex') tabIndex = attr.initializer ? attr.initializer.getText(sf) : '(bare)'
        }
        const rawKind: ControlKind | null = tag === 'button' ? 'button' : tag === 'a' && hasHref ? 'link' : null
        const kind = boundKind ?? rawKind
        if (kind) out.push({ file: relPath, line: 0, tag, kind, tabIndex, source: boundKind ? 'primitive' : 'raw' })
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
    return out
  }

  it('catches a raw <button> bypass', () => {
    const found = analyse('const A = () => <div><button type="button">Go</button></div>')
    expect(found).toHaveLength(1)
    expect(found[0].source).toBe('raw')
  })

  it('catches a raw <a href> bypass', () => {
    const found = analyse('const A = () => <a href="https://x.test">x</a>')
    expect(found).toHaveLength(1)
    expect(found[0].source).toBe('raw')
  })

  it('recognises a canonical primitive call with an inherited default', () => {
    const found = analyse('import { Button } from "./ui/Button"; const A = () => <Button>Go</Button>')
    expect(found[0]).toMatchObject({ source: 'primitive', kind: 'button', tabIndex: null })
  })

  it('sees a tabIndex through a multi-line opening containing `>` inside braces — the case a regex cannot do', () => {
    const found = analyse(`const A = () => (
      <button
        type="button"
        onMouseEnter={e => setHover(true)}
        style={{ width: 10 }}
        tabIndex={0}
      >Go</button>
    )`)
    expect(found).toHaveLength(1)
    expect(found[0].tabIndex).toBe('{0}')
  })

  it('IGNORES a <button> written inside a JSX comment — the v1.0.16 miscount, structurally', () => {
    const found = analyse('const A = () => <div>{/* <button aria-label="Close popup"> */}</div>')
    expect(found).toEqual([])
  })

  it('ignores an <a> with no href (an anchor target is not a control)', () => {
    expect(analyse('const A = () => <a id="top">x</a>')).toEqual([])
  })

  it('recognises aliases only when they come from the canonical primitive module', () => {
    const found = analyse('import { Link as NativeLink } from "./ui/Link"; const A = () => <NativeLink href="https://x.test">x</NativeLink>')
    expect(found[0]).toMatchObject({ source: 'primitive', kind: 'link', tabIndex: null })
  })

  it('does not accept a tabIndex arriving only through a spread', () => {
    const found = analyse('import { Button } from "./ui/Button"; const A = (rest) => <Button {...rest}>Go</Button>')
    expect(found[0].tabIndex).toBeNull()
  })

  it('distinguishes a roving tabIndex from a plain one, which is what makes the roster meaningful', () => {
    expect(analyse('const A = () => <button tabIndex={-1}>Go</button>')[0].tabIndex).toBe('{-1}')
    expect(analyse('const A = () => <button tabIndex={on ? 0 : -1}>Go</button>')[0].tabIndex).toBe('{on ? 0 : -1}')
  })
})
