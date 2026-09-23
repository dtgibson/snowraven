// feature: checklists-county-outline -- no inline style object pairs a CSS
// shorthand with an overlapping property that can be REMOVED on a later render.
//
// THE DEFECT CLASS. React applies an inline style key by key and, on a
// re-render, touches only the keys whose values changed. When a key disappears
// (a conditional spread stops supplying it) or its value becomes empty
// (`undefined`, `null`, a boolean, ''), React writes `style[key] = ''`, which
// deletes every longhand that key covers. It never re-applies a neighbouring
// key whose value did not change. So a `border` shorthand beside a removable
// `borderColor` loses its colour on the clear and falls back to `currentcolor`:
// the Checklists county and protocol selects drew their outline in the text
// colour after "All counties" / "All protocols". The same happens on EVERY
// render when the removable key is written after the shorthand with an empty
// value, which is how the closed species picker drew its bottom edge in the
// text colour from first paint. Both shapes shipped for many releases.
//
// THE PROPERTY ASSERTED: within one inline style object, no two keys whose
// longhands overlap may include one that can be removed. The durable shape is
// longhands with CONDITIONAL VALUES, never conditional keys: `borderColor:
// set ? a : b` beside `borderWidth` / `borderStyle`, not a `border` with a
// `borderColor` that comes and goes.
//
// WHERE THE OVERLAP TABLE COMES FROM. It is React's own `shorthandToLonghand`,
// read out of the installed react-dom development build rather than retyped
// here, so the guard means exactly what React's dev warning means ("Removing a
// style property during rerender ... when a conflicting property is set") and
// cannot drift from it. If React renames or reshapes that table, the extraction
// fails closed and this file goes red.
//
// WHY AN AST WALK. Style objects span lines, nest ternaries and spread shared
// constants (`...selectStyle`), which no regex can follow; and the walk is
// comment-immune by construction, so prose describing the defect (this file's,
// or a component's) can neither satisfy nor fail it. Same posture as
// tabOrderCoverage.test.ts. The fixture rows below prove both halves.
//
// WHAT IT CAN SEE: every `style={...}` JSX attribute in every shipped .tsx under
// src/, through object literals, spreads, ternaries, `&&`, `||`, `??`, and
// identifiers bound by a `const` in the SAME file.
//
// WHAT IT CANNOT SEE, stated so a green run is not read as more than it is:
//   * a style built by a function call, a member access (`styles.row`), an
//     import from another file, or a parameter: such an expression is counted
//     as opaque and skipped;
//   * whether an identifier VALUE can be undefined (`{ color }`, `borderColor:
//     tint`): only literal empties and ternary / logical branches are judged;
//   * style objects passed through a prop not named `style`, or built with
//     createElement in a .ts file;
//   * the neighbouring hazard where a shorthand CHANGES and an unchanged
//     overlapping longhand is overwritten (React's "Updating ..." warning), and
//     a static key-order collision. Neither is a removal, and neither is
//     asserted here.
// The render test in components/Checklists.test.tsx covers the Checklists
// selects behaviourally, and fails on React's own collision warning.
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const SRC = fileURLToPath(new URL('../', import.meta.url)) // frontend/src/
const REACT_DOM_DEV = fileURLToPath(
  new URL('../../node_modules/react-dom/cjs/react-dom-client.development.js', import.meta.url),
)

// ── React's overlap table ───────────────────────────────────────────────────

/** `shorthandToLonghand` from the installed react-dom dev build, parsed, never evaluated. */
function reactShorthandTable(): Map<string, string[]> {
  const text = readFileSync(REACT_DOM_DEV, 'utf8')
  const marker = 'shorthandToLonghand = {'
  const at = text.indexOf(marker)
  if (at < 0 || text.indexOf(marker, at + 1) >= 0) {
    throw new Error(`expected exactly one "${marker}" in react-dom's dev build; React has reshaped it`)
  }
  // Brace-match the literal. Its values are plain strings with no braces.
  const open = at + marker.length - 1
  let depth = 0
  let end = open
  for (; end < text.length; end++) {
    if (text[end] === '{') depth++
    else if (text[end] === '}' && --depth === 0) break
  }
  const sf = ts.createSourceFile('table.js', `(${text.slice(open, end + 1)})`, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS)
  const stmt = sf.statements[0]
  const lit = stmt && ts.isExpressionStatement(stmt) && ts.isParenthesizedExpression(stmt.expression)
    ? stmt.expression.expression : undefined
  if (!lit || !ts.isObjectLiteralExpression(lit)) throw new Error('react-dom shorthand table is not an object literal')
  const table = new Map<string, string[]>()
  for (const p of lit.properties) {
    if (!ts.isPropertyAssignment(p) || !(ts.isIdentifier(p.name) || ts.isStringLiteral(p.name))) {
      throw new Error(`unrecognised member in react-dom shorthand table: ${p.getText(sf)}`)
    }
    const v = p.initializer
    let longhands: string[] | null = null
    if (ts.isArrayLiteralExpression(v) && v.elements.every(ts.isStringLiteral)) {
      longhands = v.elements.map(e => (e as ts.StringLiteral).text)
    } else if (
      ts.isCallExpression(v) && ts.isPropertyAccessExpression(v.expression) &&
      v.expression.name.text === 'split' && ts.isStringLiteral(v.expression.expression) &&
      v.arguments.length === 1 && ts.isStringLiteral(v.arguments[0]) && v.arguments[0].text === ' '
    ) {
      longhands = v.expression.expression.text.split(' ')
    }
    if (!longhands) throw new Error(`unrecognised value for ${p.name.text} in react-dom shorthand table`)
    table.set(p.name.text, longhands)
  }
  return table
}

const TABLE = reactShorthandTable()
const longhandsOf = (key: string): string[] => TABLE.get(key) ?? [key]
const overlaps = (a: string, b: string): boolean => {
  const lb = new Set(longhandsOf(b))
  return longhandsOf(a).some(l => lb.has(l))
}

// ── The analyser ────────────────────────────────────────────────────────────

/** A key's standing in a resolved style object. */
interface KeyState {
  always: boolean // present on every render
  emptyable: boolean // some render can give it a value React treats as empty
}
interface Resolution { keys: Map<string, KeyState>; opaque: number }

/** One `style={...}` attribute, resolved. */
interface StyleSite {
  line: number
  element: string // the opening tag's source text, for the positive leg only
  keys: Map<string, KeyState>
  opaque: number // sub-expressions the analyser could not follow
}
interface Violation { file: string; line: number; a: string; b: string }
interface Scan {
  sites: StyleSite[]
  violations: Violation[]
  identifierResolutions: number // same-file const identifiers followed
}

const clearable = (s: KeyState): boolean => !s.always || s.emptyable

const unwrap = (e: ts.Expression): ts.Expression => {
  let x = e
  while (
    ts.isParenthesizedExpression(x) || ts.isAsExpression(x) || ts.isSatisfiesExpression(x) ||
    ts.isTypeAssertionExpression(x) || ts.isNonNullExpression(x)
  ) x = x.expression
  return x
}

/** Can this value be one React treats as empty (null, undefined, a boolean, '')? */
function canBeEmpty(e: ts.Expression): boolean {
  const x = unwrap(e)
  if (ts.isIdentifier(x)) return x.text === 'undefined'
  if (x.kind === ts.SyntaxKind.NullKeyword || x.kind === ts.SyntaxKind.TrueKeyword || x.kind === ts.SyntaxKind.FalseKeyword) return true
  if (ts.isStringLiteral(x) || ts.isNoSubstitutionTemplateLiteral(x)) return x.text === ''
  if (ts.isVoidExpression(x)) return true
  if (ts.isConditionalExpression(x)) return canBeEmpty(x.whenTrue) || canBeEmpty(x.whenFalse)
  if (ts.isBinaryExpression(x)) {
    const op = x.operatorToken.kind
    if (op === ts.SyntaxKind.AmpersandAmpersandToken) return true // `c && v` is false or '' when c is
    if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) return canBeEmpty(x.right)
  }
  return false
}

/** Either-branch combination: a key in only one branch is present on some renders only. */
function join(a: Resolution, b: Resolution): Resolution {
  const keys = new Map<string, KeyState>()
  for (const k of new Set([...a.keys.keys(), ...b.keys.keys()])) {
    const x = a.keys.get(k)
    const y = b.keys.get(k)
    keys.set(k, { always: !!x?.always && !!y?.always, emptyable: !!x?.emptyable || !!y?.emptyable })
  }
  return { keys, opaque: a.opaque + b.opaque }
}

const OPAQUE = (): Resolution => ({ keys: new Map(), opaque: 1 })
const NOTHING = (): Resolution => ({ keys: new Map(), opaque: 0 })

function scanSource(file: string, text: string): Scan {
  const sf = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const scan: Scan = { sites: [], violations: [], identifierResolutions: 0 }

  // Same-file const bindings. A name bound twice is ambiguous and stays opaque.
  const consts = new Map<string, ts.Expression | null>()
  const collect = (n: ts.Node): void => {
    if (
      ts.isVariableDeclaration(n) && ts.isIdentifier(n.name) && n.initializer &&
      (ts.getCombinedNodeFlags(n) & ts.NodeFlags.Const) !== 0
    ) consts.set(n.name.text, consts.has(n.name.text) ? null : n.initializer)
    ts.forEachChild(n, collect)
  }
  collect(sf)

  const resolve = (e: ts.Expression, depth: number): Resolution => {
    if (depth > 8) return OPAQUE()
    const x = unwrap(e)
    if (ts.isObjectLiteralExpression(x)) {
      const keys = new Map<string, KeyState>()
      let opaque = 0
      for (const p of x.properties) {
        if (ts.isPropertyAssignment(p)) {
          if (ts.isIdentifier(p.name) || ts.isStringLiteral(p.name)) {
            keys.set(p.name.text, { always: true, emptyable: canBeEmpty(p.initializer) })
          } else if (ts.isComputedPropertyName(p.name)) {
            // A custom property (`['--sr-ctl-rem' as string]`) overlaps nothing.
            const inner = unwrap(p.name.expression)
            if (!(ts.isStringLiteral(inner) && inner.text.startsWith('--'))) opaque++
          } else opaque++
        } else if (ts.isShorthandPropertyAssignment(p)) {
          keys.set(p.name.text, { always: true, emptyable: false }) // value unknowable here
        } else if (ts.isSpreadAssignment(p)) {
          const r = resolve(p.expression, depth + 1)
          opaque += r.opaque
          for (const [k, s] of r.keys) {
            const prev = keys.get(k)
            // A key the spread always supplies replaces what came before; one it
            // supplies sometimes leaves the earlier value in place on other renders.
            keys.set(k, s.always ? s : { always: !!prev?.always, emptyable: !!prev?.emptyable || s.emptyable })
          }
        } else opaque++
      }
      return { keys, opaque }
    }
    if (ts.isConditionalExpression(x)) return join(resolve(x.whenTrue, depth + 1), resolve(x.whenFalse, depth + 1))
    if (ts.isBinaryExpression(x)) {
      const op = x.operatorToken.kind
      if (op === ts.SyntaxKind.AmpersandAmpersandToken) return join(resolve(x.right, depth + 1), NOTHING())
      if (op === ts.SyntaxKind.BarBarToken || op === ts.SyntaxKind.QuestionQuestionToken) {
        return join(resolve(x.left, depth + 1), resolve(x.right, depth + 1))
      }
      return OPAQUE()
    }
    if (x.kind === ts.SyntaxKind.NullKeyword || x.kind === ts.SyntaxKind.FalseKeyword || x.kind === ts.SyntaxKind.TrueKeyword) return NOTHING()
    if (ts.isIdentifier(x)) {
      if (x.text === 'undefined') return NOTHING()
      const bound = consts.get(x.text)
      if (!bound) return OPAQUE()
      scan.identifierResolutions++
      return resolve(bound, depth + 1)
    }
    return OPAQUE()
  }

  const visit = (n: ts.Node): void => {
    if (
      ts.isJsxAttribute(n) && ts.isIdentifier(n.name) && n.name.text === 'style' &&
      n.initializer && ts.isJsxExpression(n.initializer) && n.initializer.expression
    ) {
      const r = resolve(n.initializer.expression, 0)
      const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1
      scan.sites.push({ line, element: n.parent.parent.getText(sf), keys: r.keys, opaque: r.opaque })
      const entries = [...r.keys]
      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const [a, sa] = entries[i]
          const [b, sb] = entries[j]
          if ((clearable(sa) || clearable(sb)) && overlaps(a, b)) scan.violations.push({ file, line, a, b })
        }
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return scan
}

const pairs = (s: Scan): string[] => s.violations.map(v => `${v.a} + ${v.b}`)

/** Every SHIPPED .tsx under src/, relative to src/. Walked, never listed. */
function shippedComponents(): string[] {
  const found: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(`${SRC}${dir}`, { withFileTypes: true })) {
      if (entry.isDirectory()) { walk(`${dir}${entry.name}/`); continue }
      if (!entry.isFile() || !entry.name.endsWith('.tsx') || entry.name.endsWith('.test.tsx')) continue
      found.push(`${dir}${entry.name}`)
    }
  }
  walk('')
  return found.sort()
}

// ── The guard ───────────────────────────────────────────────────────────────

describe('inline styles never pair a shorthand with a removable overlapping key', () => {
  const files = shippedComponents()
  const scans = new Map(files.map(f => [f, scanSource(f, readFileSync(`${SRC}${f}`, 'utf8'))]))
  const sites = [...scans.values()].flatMap(s => s.sites)
  const keyStates = sites.flatMap(s => [...s.keys.values()])

  it('finds no such pair in any shipped component', () => {
    const found = [...scans.entries()].flatMap(([, s]) => s.violations).map(v => `${v.file}:${v.line} ${v.a} + ${v.b}`)
    expect(
      found,
      'a shorthand and an overlapping key share one inline style, and one of them can be removed on a ' +
      're-render (a conditional key, or a value that can be undefined / null / a boolean / empty). React ' +
      'then clears the overlap without re-applying the other. Write longhands with conditional VALUES instead.',
    ).toEqual([])
  })

  // Non-vacuity, per partition of the analyser: a scanner that silently stopped
  // walking files, following `const` spreads, or recognising conditional keys
  // and empty values would otherwise pass as a clean scan.
  it('actually reads the tree, through every resolution path', () => {
    // Floors, not counts (93 files and 1,989 attributes when this was written):
    // they exist to catch a walk that silently stopped, not to pin the tree.
    expect(files.length, 'shipped .tsx files walked').toBeGreaterThan(50)
    expect(sites.length, 'style attributes seen').toBeGreaterThan(1000)
    const opaqueWhole = sites.filter(s => s.keys.size === 0 && s.opaque > 0).length
    expect(opaqueWhole, 'most style attributes are followed, not skipped').toBeLessThan(sites.length / 10)
    expect([...scans.values()].reduce((n, s) => n + s.identifierResolutions, 0), 'same-file const identifiers followed').toBeGreaterThan(0)
    expect(keyStates.filter(k => !k.always).length, 'conditional keys recognised').toBeGreaterThan(0)
    expect(keyStates.filter(k => k.emptyable).length, 'emptyable values recognised').toBeGreaterThan(0)
  })

  // The positive leg: the three sites this guard was written for are still
  // inside its reach, fully resolved, with some key that draws their border
  // colour. It deliberately does not pin WHICH key, so any correct rewrite
  // stays green; if a site moves behind a function call or an import, this row
  // says so, instead of the scan above passing over a site it can no longer see.
  it('still reaches the three sites it was written for', () => {
    const drawsBorderColour = (s: StyleSite): boolean =>
      [...s.keys.keys()].some(k => longhandsOf(k).includes('borderBottomColor'))
    const reached = (file: string, marker: RegExp): StyleSite[] =>
      scans.get(file)!.sites.filter(s => marker.test(s.element) && s.opaque === 0 && drawsBorderColour(s))
    expect(reached('components/Checklists.tsx', /aria-label="(County|Protocol)"/), 'Checklists county + protocol selects').toHaveLength(2)
    expect(reached('components/SpeciesCombobox.tsx', /role="combobox"/), 'the species picker input').toHaveLength(1)
  })
})

describe('the analyser (guard-the-guard)', () => {
  it('reads React\'s own overlap table', () => {
    expect(TABLE.size, 'entries extracted').toBeGreaterThan(30)
    for (const side of ['Top', 'Right', 'Bottom', 'Left']) {
      expect(longhandsOf('border')).toContain(`border${side}Color`)
      expect(longhandsOf('borderColor')).toContain(`border${side}Color`)
    }
    expect(longhandsOf('background')).toContain('backgroundColor')
    expect(overlaps('border', 'borderBottomColor')).toBe(true)
    expect(overlaps('borderWidth', 'borderColor')).toBe(false)
    expect(overlaps('borderRadius', 'border')).toBe(false)
  })

  // The shapes that shipped, reproduced: each must be flagged, naming the pair.
  it.each([
    ['the Checklists selects (a conditional colour spread over a shared `border`)',
      `const selectStyle = { height: 28, border: '1.5px solid var(--a)', color: 'var(--t)' }
       const X = () => <select style={{ ...selectStyle, ...(set ? { borderColor: 'var(--b)', color: 'var(--c)', fontWeight: 600 } : {}) }} />`,
      ['border + borderColor']],
    ['the species picker (a bottom colour that is `undefined` when closed)',
      `const X = () => <input style={{ border: \`1.5px solid \${open ? 'var(--a)' : 'var(--b)'}\`, borderRadius: 6, borderBottomColor: open ? 'transparent' : undefined }} />`,
      ['border + borderBottomColor']],
    ['a removable SHORTHAND over a steady longhand (the reverse order of removal)',
      `const X = () => <div style={{ border: on ? '1px solid var(--a)' : undefined, borderTopColor: 'var(--b)' }} />`,
      ['border + borderTopColor']],
    ['an `&&` spread supplying a longhand on some renders',
      `const X = () => <div style={{ margin: 0, ...(on && { marginTop: 4 }) }} />`,
      ['margin + marginTop']],
    ['a whole-object ternary where only one branch carries the longhand',
      `const X = () => <div style={on ? { background: 'var(--a)', backgroundColor: 'var(--b)' } : { background: 'var(--a)' }} />`,
      ['background + backgroundColor']],
    ['an empty string or null as the removable value',
      `const X = () => <div style={{ padding: 4, paddingLeft: on ? 8 : '', outline: 'none', outlineColor: null }} />`,
      ['padding + paddingLeft', 'outline + outlineColor']],
  ])('flags %s', (_label, source, expected) => {
    expect(pairs(scanSource('fixture.tsx', source))).toEqual(expected)
  })

  // Equivalent shapes that must stay GREEN, including both fixed forms.
  it.each([
    ['the fixed Checklists selects (longhands, the colour key always present)',
      `const selectStyle = { borderWidth: '1.5px', borderStyle: 'solid', borderColor: 'var(--a)', color: 'var(--t)' }
       const X = () => <select style={{ ...selectStyle, ...(set ? { borderColor: 'var(--b)', color: 'var(--c)', fontWeight: 600 } : {}) }} />`],
    ['the fixed species picker (one colour key with a conditional value)',
      `const X = () => <input style={{ borderWidth: '1.5px', borderStyle: 'solid', borderColor: open ? 'var(--a) var(--a) transparent' : 'var(--b)', borderRadius: open ? '6px 6px 0 0' : 6 }} />`],
    ['a steady shorthand + steady longhand pair (a static order, not a removal)',
      `const X = () => <button style={{ border: 'none', borderTop: '1px solid var(--a)' }} />`],
    ['a conditional key that overlaps nothing',
      `const X = () => <span style={{ color: 'var(--a)', ...(on ? { fontWeight: 600 } : {}) }} />`],
    ['a custom property beside a shorthand',
      `const X = () => <input style={{ font: 'inherit', ['--sr-ctl-rem' as string]: size }} />`],
    ['the defect written only in comments',
      `/* <div style={{ border: 'x', borderBottomColor: c ? 'y' : undefined }} /> */
       // <div style={{ border: 'x', borderBottomColor: c ? 'y' : undefined }} />
       const X = () => <div>{/* <i style={{ border: 'x', borderColor: c ? 'y' : undefined }} /> */}</div>`],
  ])('passes %s', (_label, source) => {
    expect(pairs(scanSource('fixture.tsx', source))).toEqual([])
  })

  it('counts what it cannot follow as opaque rather than guessing', () => {
    const scan = scanSource('fixture.tsx', `const X = () => <div style={makeStyle(on)} />`)
    expect(scan.sites).toHaveLength(1)
    expect(scan.sites[0].opaque).toBe(1)
    expect(scan.violations).toEqual([])
  })
})
