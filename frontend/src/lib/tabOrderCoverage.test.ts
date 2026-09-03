// feature: webkit-tab-order-app-wide — every control SnowRaven itself renders
// asks for its place in the tab order EXPLICITLY, app-wide.
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
// intrinsic <button> and every <a href> in the app's own sources carries a
// literal tabIndex={0}, apart from the EXCLUSIONS roster below. ACCESSIBILITY.md
// publishes exactly that sentence. A count ("45 of 45") would depend on a scan
// method, and three defensible methods disagreed during the v1.0.16 build; a
// property cannot be wrong.
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
// WHY THIS GUARD AND components/mapCornerTabStops.test.tsx BOTH EXIST — neither
// subsumes the other, and deleting either loses real coverage:
//   * THIS file reads SOURCE. It sees every shipped .tsx file in the tree,
//     including the ones no test has ever mounted, so a brand-new component's
//     unmarked button fails here without anyone remembering to write a row for
//     it. What it CANNOT see is a tabIndex a component strips at RENDER time
//     behind its own conditional — in source that still reads tabIndex={0}.
//   * THAT file reads the RENDERED DOM of the map corner controls, so it catches
//     exactly the render-time case this one is blind to. What it cannot see is a
//     file nobody mounted, which is most of the app.
// Source coverage is broad and shallow; render coverage is narrow and deep.
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
import ts from 'typescript'

const SRC = fileURLToPath(new URL('../', import.meta.url)) // frontend/src/

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

type Site = { file: string; line: number; tag: string; tabIndex: string | null }

/**
 * Every intrinsic <button> and every <a href> in one file, with the SOURCE TEXT
 * of its own tabIndex initializer (null when the attribute is absent).
 *
 * Intrinsic only: a lowercase tag name is a real DOM element. <OutboundLink> and
 * friends are components, and the <a> they own is reached when this walk visits
 * OutboundLink.tsx itself — counting the call sites too would make one component's
 * single edit look like 39 obligations.
 *
 * A tabIndex arriving through {...spread} does not count as explicit here. That
 * is deliberate and it is the stricter reading: the spread's contents are not
 * knowable from this element, so a guard that accepted one would pass an element
 * whose attribute may never materialise.
 */
const sitesIn = (relPath: string): Site[] => {
  const text = readFileSync(`${SRC}${relPath}`, 'utf8')
  const sf = ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const out: Site[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(sf)
      if (tag === 'button' || tag === 'a') {
        let hasHref = false
        let tabIndex: string | null = null
        for (const attr of node.attributes.properties) {
          if (ts.isJsxSpreadAttribute(attr)) continue
          const name = attr.name.getText(sf)
          if (name === 'href') hasHref = true
          if (name === 'tabIndex') tabIndex = attr.initializer ? attr.initializer.getText(sf) : '(bare)'
        }
        if (tag === 'button' || hasHref) {
          out.push({
            file: relPath,
            line: sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1,
            tag,
            tabIndex,
          })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return out
}

const allSites = (): Site[] => shippedComponents().flatMap(sitesIn)

/**
 * The ONLY controls permitted to carry something other than tabIndex={0}.
 *
 * Blanket-marking these breaks arrow-key navigation, or re-adds a control the
 * platform deliberately removed, so this roster is the regression risk in this
 * feature rather than an afterthought.
 *
 * THEY ARE NOT ALL ONE KIND, and saying so matters, because the prose that
 * publishes them has to be true of EACH:
 *   - THREE are roving-tabindex GROUPS: the container holds one tab stop and the
 *     arrow keys move within it (the tab bar, its collapsed dropdown, the
 *     Settings choice rows). ACCESSIBILITY.md describes these under Keyboard
 *     Navigation.
 *   - ONE is a redundant affordance and is NOT roving: the species selector's
 *     chevron is a fixed tabIndex={-1}, and the arrow keys never move to it.
 *     They move an aria-activedescendant index on the <input> beside it, which
 *     is itself a tab stop whose onFocus opens the same list. It is skipped
 *     because something else already does its job, not because a group owns its
 *     stop.
 *   - ONE is not a tab-order decision at all: the offline base-map button
 *     carries native `disabled`, so the platform removes it whatever its
 *     tabIndex says. ACCESSIBILITY.md publishes that under OFFLINE STATES,
 *     deliberately apart from the other four, because "another tab stop already
 *     reaches it" is not the reason.
 * A summary calling all five roving-tabindex widgets is false twice over, and an
 * earlier revision of this very docstring said exactly that while row five's own
 * `why` field contradicted it. Prose and roster are checked against each other.
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
    tabIndex: '{activeTab === item.id ? 0 : -1}',
    count: 1,
    why: 'roving group: role="tab", so the tablist holds one stop and ArrowLeft/ArrowRight move between tabs',
  },
  {
    file: 'components/TabNav.tsx',
    tabIndex: '{-1}',
    count: 1,
    why: 'roving group: role="option" in the collapsed tab-bar listbox, moved by the programmatic focus ArrowUp/ArrowDown drive',
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
    expect(sites.filter(s => s.tag === 'button').length).toBeGreaterThan(150)
    expect(sites.filter(s => s.tag === 'a').length).toBeGreaterThan(10)
  })

  it('no intrinsic <button> or <a href> lacks a literal tabIndex={0}, apart from the roster', () => {
    const offenders = allSites()
      .filter(s => s.tabIndex !== '{0}')
      .filter(s => !isExcluded(s))
      .map(s => `${s.file}:${s.line}  <${s.tag}>  tabIndex=${s.tabIndex ?? '(absent)'}`)

    // Named in the failure so a new unmarked control reads as an instruction
    // rather than as a number that moved: add tabIndex={0}, or, if it is a
    // control a neighbouring tab stop already reaches, add a row to EXCLUSIONS
    // (with its site count) and describe it in ACCESSIBILITY.md.
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

  it('the roster accounts for every non-{0} site exactly once, so prose and code cannot drift', () => {
    // ACCESSIBILITY.md names these exceptions individually. If a sixth appears,
    // or a rostered one gains a sibling, that prose has become false and this
    // fails. Compared as a COUNTED multiset rather than a de-duplicated set: a
    // set collapses two sites sharing a file and an initializer into one entry,
    // which is the exact hole the row counts above exist to close.
    const nonZero = allSites().filter(s => s.tabIndex !== '{0}')
    expect(nonZero.every(isExcluded)).toBe(true)

    const found = new Map<string, number>()
    for (const s of nonZero) {
      const k = countKey(s.file, s.tabIndex)
      found.set(k, (found.get(k) ?? 0) + 1)
    }
    const expected = new Map(EXCLUSIONS.map(e => [countKey(e.file, e.tabIndex), e.count]))
    expect(Object.fromEntries([...found].sort())).toEqual(Object.fromEntries([...expected].sort()))
    expect(nonZero.length).toBe(EXCLUSIONS.reduce((n, e) => n + e.count, 0))
  })
})

describe('the scan itself behaves as claimed (mutation checks)', () => {
  // These run the analyser over source strings rather than over the tree, so a
  // failure points at the ANALYSER, not at a component. A guard whose scanner is
  // broken passes everything, which is the failure mode worth buying against.
  const analyse = (src: string): Site[] => {
    const sf = ts.createSourceFile('probe.tsx', src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    const out: Site[] = []
    const visit = (node: ts.Node): void => {
      if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
        const tag = node.tagName.getText(sf)
        if (tag === 'button' || tag === 'a') {
          let hasHref = false
          let tabIndex: string | null = null
          for (const attr of node.attributes.properties) {
            if (ts.isJsxSpreadAttribute(attr)) continue
            const name = attr.name.getText(sf)
            if (name === 'href') hasHref = true
            if (name === 'tabIndex') tabIndex = attr.initializer ? attr.initializer.getText(sf) : '(bare)'
          }
          if (tag === 'button' || hasHref) out.push({ file: 'probe.tsx', line: 0, tag, tabIndex })
        }
      }
      ts.forEachChild(node, visit)
    }
    visit(sf)
    return out
  }

  it('catches an unmarked <button> — the defect this feature fixed', () => {
    const found = analyse('const A = () => <div><button type="button">Go</button></div>')
    expect(found).toHaveLength(1)
    expect(found[0].tabIndex).toBeNull()
  })

  it('catches an unmarked <a href> — the other half of the defect', () => {
    const found = analyse('const A = () => <a href="https://x.test">x</a>')
    expect(found).toHaveLength(1)
    expect(found[0].tabIndex).toBeNull()
  })

  it('accepts a marked control', () => {
    expect(analyse('const A = () => <button tabIndex={0}>Go</button>')[0].tabIndex).toBe('{0}')
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

  it('ignores COMPONENTS whose name merely looks like a tag', () => {
    // <OutboundLink> owns its own <a>; that <a> is checked in OutboundLink.tsx.
    expect(analyse('const A = () => <OutboundLink href="https://x.test">x</OutboundLink>')).toEqual([])
  })

  it('does not accept a tabIndex arriving only through a spread', () => {
    const found = analyse('const A = (rest) => <button {...rest}>Go</button>')
    expect(found[0].tabIndex).toBeNull()
  })

  it('distinguishes a roving tabIndex from a plain one, which is what makes the roster meaningful', () => {
    expect(analyse('const A = () => <button tabIndex={-1}>Go</button>')[0].tabIndex).toBe('{-1}')
    expect(analyse('const A = () => <button tabIndex={on ? 0 : -1}>Go</button>')[0].tabIndex).toBe('{on ? 0 : -1}')
  })
})
