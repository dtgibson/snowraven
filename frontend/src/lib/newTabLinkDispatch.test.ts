// feature: sortable-list-links-own-dispatch. Every new-tab link the app draws
// sends its OWN URL to the opener in the Tauri apps.
//
// THE PROPERTY. Every JSX element in shipped source whose `target` is "_blank"
// carries an `onClick` that calls `openNewTabLink` (lib/openExternal.ts), and
// passes it the SAME expression the element renders as its `href`, so the URL
// opened is the URL rendered. Nothing after that `onClick` may be a spread that
// could replace it. A "_blank" written anywhere else in shipped source (a spread
// object, a DOM `target` assignment, an HTML string) is a new-tab link this scan
// cannot vouch for, and the only one permitted is openExternal.ts's own web path.
//
// WHY. The opener plugin's window-level listener opens a clicked new-tab anchor
// by reading its `href` back from the live DOM after every React handler has run.
// A link that sends its own URL and cancels the click removes that dependency:
// a re-sort, a re-render or a caller's handler can no longer change which page
// opens. A link added without the handler would quietly fall back to the
// listener, and nothing else would notice.
//
// WHY AN AST WALK. These openings span lines and carry `>` inside braces, and an
// AST is comment-immune by construction: a handler call written in a comment is
// not a call, and a target="_blank" written in a JSX comment is not an element
// (the rows below prove both). Same posture as lib/tabOrderCoverage.test.ts.
//
// LINEARITY. One parse and one pre-order walk per file, each linear in the
// file's length; the per-element work is bounded by that element's own
// attributes and its onClick subtree, each visited once. Linear in the source.
//
// WHAT IT CANNOT SEE. Behavior: that the handler cancels the click, honors the
// opener's gate, and sends the anchor's resolved href. The component rows own
// that (OutboundLink.test.tsx and the rows in ChecklistLink, SpeciesLinks,
// CommentText, LifeListTable and Targets tests). It also cannot see an anchor a
// library draws at runtime; none of those opens a new tab today.

import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, normalize } from 'node:path/posix'
import ts from 'typescript'

const SRC = fileURLToPath(new URL('../', import.meta.url)) // frontend/src/

/** The handler module, relative to src/ and without its extension. */
const HANDLER_MODULE = 'lib/openExternal'
const HANDLER_NAME = 'openNewTabLink'
/** The one place a "_blank" may appear outside a JSX `target`: the web path of openExternalUrl. */
const PERMITTED_OTHER = ['lib/openExternal.ts']

/**
 * Every SHIPPED .ts/.tsx under src/, relative to src/. Tests, the test-setup file
 * and the src/test/ helpers never ship. Walked rather than listed: naming the
 * files is the assumption this guard exists to remove.
 */
const shippedSources = (): string[] => {
  const found: string[] = []
  const walk = (dir: string): void => {
    for (const entry of readdirSync(`${SRC}${dir}`, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        if (dir === '' && entry.name === 'test') continue
        walk(`${dir}${entry.name}/`)
        continue
      }
      if (!entry.isFile()) continue
      const name = entry.name
      if (!/\.tsx?$/.test(name) || /\.test\.tsx?$/.test(name) || name.endsWith('.d.ts')) continue
      if (dir === '' && name === 'test-setup.ts') continue
      found.push(`${dir}${name}`)
    }
  }
  walk('')
  return found.sort()
}

type Site = { file: string; line: number; tag: string; problem: string | null }
type Other = { file: string; line: number; text: string }

/** The text of a string-literal initializer, or of `{'...'}` / {`...`}; null for anything else. */
const literalOf = (node: ts.Node | undefined): string | null => {
  if (!node) return null
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isJsxExpression(node) && node.expression) return literalOf(node.expression)
  return null
}

/** A comparable key for an href initializer or a call argument. */
const valueKey = (node: ts.Node, sf: ts.SourceFile): string => {
  const lit = literalOf(node)
  if (lit !== null) return `literal:${lit}`
  if (ts.isJsxExpression(node) && node.expression) return `expr:${node.expression.getText(sf)}`
  return `expr:${node.getText(sf)}`
}

/** Local names bound to the handler by an import from the handler module, aliases included. */
const handlerBindings = (sf: ts.SourceFile, relPath: string): Set<string> => {
  const names = new Set<string>()
  for (const statement of sf.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue
    const spec = statement.moduleSpecifier.text
    if (!spec.startsWith('.')) continue
    const target = normalize(join(dirname(relPath), spec)).replace(/\.tsx?$/, '')
    if (target !== HANDLER_MODULE) continue
    const bindings = statement.importClause?.namedBindings
    if (!bindings || !ts.isNamedImports(bindings)) continue
    for (const b of bindings.elements) {
      if ((b.propertyName ?? b.name).text === HANDLER_NAME) names.add(b.name.text)
    }
  }
  return names
}

/** Why this new-tab element does not carry its own dispatch, or null when it does. */
const problemWith = (
  el: ts.JsxOpeningElement | ts.JsxSelfClosingElement,
  sf: ts.SourceFile,
  handlers: Set<string>,
): string | null => {
  const props = el.attributes.properties
  const attr = (name: string): ts.JsxAttribute | undefined => props
    .find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === name)
  const target = attr('target')!
  if (literalOf(target.initializer) === null) return 'target is not a literal, so this scan cannot tell whether it opens a new tab'
  const onClick = attr('onClick')
  if (!onClick) return 'no onClick'
  const href = attr('href')
  if (!href || !href.initializer) return 'no href to dispatch'
  const hrefKey = valueKey(href.initializer, sf)
  const index = props.indexOf(onClick)
  if (props.slice(index + 1).some(p => ts.isJsxSpreadAttribute(p))) return 'a spread after onClick can replace the handler'
  if (!onClick.initializer || !ts.isJsxExpression(onClick.initializer) || !onClick.initializer.expression) {
    return 'onClick is not an expression'
  }
  let called = false
  let ownHref = false
  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && handlers.has(node.expression.text)) {
      called = true
      const url = node.arguments[1]
      if (url && valueKey(url, sf) === hrefKey) ownHref = true
    }
    ts.forEachChild(node, visit)
  }
  visit(onClick.initializer.expression)
  if (!called) return `onClick never calls ${HANDLER_NAME}`
  if (!ownHref) return `${HANDLER_NAME} is not given the element's own href expression`
  return null
}

/** Every new-tab JSX element in one source, and every other "_blank" literal. */
const analyse = (relPath: string, text: string): { sites: Site[]; others: Other[] } => {
  const sf = ts.createSourceFile(relPath, text, ts.ScriptTarget.Latest, true,
    relPath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS)
  const handlers = handlerBindings(sf, relPath)
  const sites: Site[] = []
  const others: Other[] = []
  const accounted = new Set<ts.Node>()
  const lineOf = (node: ts.Node) => sf.getLineAndCharacterOfPosition(node.getStart(sf)).line + 1
  const visit = (node: ts.Node): void => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const target = node.attributes.properties
        .find((p): p is ts.JsxAttribute => ts.isJsxAttribute(p) && p.name.getText(sf) === 'target')
      const literal = literalOf(target?.initializer)
      if (target && (literal === '_blank' || literal === null)) {
        // Mark the literal as accounted for, so the pass below does not count it twice.
        const init = target.initializer
        if (init) {
          accounted.add(init)
          if (ts.isJsxExpression(init) && init.expression) accounted.add(init.expression)
        }
        sites.push({ file: relPath, line: lineOf(node), tag: node.tagName.getText(sf), problem: problemWith(node, sf, handlers) })
      }
    }
    const isText = ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
      || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)
    if (isText && !accounted.has(node) && (node as ts.LiteralLikeNode).text.includes('_blank')) {
      others.push({ file: relPath, line: lineOf(node), text: (node as ts.LiteralLikeNode).text })
    }
    ts.forEachChild(node, visit)
  }
  visit(sf)
  return { sites, others }
}

const scanTree = () => {
  const sites: Site[] = []
  const others: Other[] = []
  for (const file of shippedSources()) {
    const found = analyse(file, readFileSync(`${SRC}${file}`, 'utf8'))
    sites.push(...found.sites)
    others.push(...found.others)
  }
  return { sites, others }
}

describe('every new-tab link carries its own dispatch', () => {
  const { sites, others } = scanTree()

  it('finds the population at all (the guard is not silently scanning nothing)', () => {
    expect(shippedSources().length).toBeGreaterThan(100)
    // A floor, not a total: the shared owners and the hand-written sites at the
    // time of writing. Every one of these files must still be reached.
    expect(sites.length).toBeGreaterThan(10)
    const files = new Set(sites.map(s => s.file))
    for (const owner of [
      'components/OutboundLink.tsx',
      'components/ChecklistLink.tsx',
      'components/SpeciesLinks.tsx',
      'components/CommentText.tsx',
      'components/LifeListTable.tsx',
      'components/SpeciesDetail.tsx',
      'components/WeatherTabLinks.tsx',
    ]) expect(files, owner).toContain(owner)
  })

  it(`every target="_blank" element calls ${HANDLER_NAME} with its own href`, () => {
    const offenders = sites.filter(s => s.problem !== null).map(s => `${s.file}:${s.line} <${s.tag}> ${s.problem}`)
    expect(offenders).toEqual([])
  })

  it('no other "_blank" in shipped source except openExternalUrl\'s web path', () => {
    expect([...new Set(others.map(o => o.file))].sort()).toEqual(PERMITTED_OTHER)
  })
})

describe('the scan itself behaves as claimed (mutation checks)', () => {
  // The analyser over source strings, so a failure points at the ANALYSER rather
  // than at a component. A broken scanner passes everything.
  const IMPORT = `import { Link } from './ui/Link'\nimport { ${HANDLER_NAME} } from '../lib/openExternal'\n`
  const probe = (jsx: string, prelude = IMPORT) => analyse('components/Probe.tsx', `${prelude}const A = (p) => (${jsx})`)
  const problems = (jsx: string, prelude?: string) => probe(jsx, prelude).sites.map(s => s.problem)

  it('accepts a link that sends its own href', () => {
    expect(problems(`<Link href={url} target="_blank" onClick={e => ${HANDLER_NAME}(e, url)}>x</Link>`)).toEqual([null])
    expect(problems(`<a href="https://x.test" target={'_blank'} onClick={e => ${HANDLER_NAME}(e, 'https://x.test')}>x</a>`)).toEqual([null])
    // A caller handler composed in front of it.
    expect(problems(`<Link href={href} target="_blank" {...rest} onClick={e => { onClick?.(e); ${HANDLER_NAME}(e, href) }}>x</Link>`)).toEqual([null])
    // An aliased import is the same handler.
    expect(problems(`<a href={u} target="_blank" onClick={e => open(e, u)}>x</a>`,
      `import { ${HANDLER_NAME} as open } from '../lib/openExternal.ts'\n`)).toEqual([null])
    // The same import path from a file at another depth must resolve the same way.
    expect(analyse('App.tsx', `import { ${HANDLER_NAME} } from './lib/openExternal'\nconst A = () => (<a href={u} target="_blank" onClick={e => ${HANDLER_NAME}(e, u)}>x</a>)`)
      .sites.map(s => s.problem)).toEqual([null])
  })

  it.each([
    ['no onClick', `<Link href={url} target="_blank">x</Link>`, 'no onClick'],
    ['an onClick that does something else', `<Link href={url} target="_blank" onClick={e => track(e)}>x</Link>`, `onClick never calls ${HANDLER_NAME}`],
    ['the call written only in a comment', `<Link href={url} target="_blank" onClick={e => { /* ${HANDLER_NAME}(e, url) */ }}>x</Link>`, `onClick never calls ${HANDLER_NAME}`],
    ['a URL other than the href', `<Link href={url} target="_blank" onClick={e => ${HANDLER_NAME}(e, otherUrl)}>x</Link>`, `${HANDLER_NAME} is not given the element's own href expression`],
    ['a spread after onClick', `<Link href={url} target="_blank" onClick={e => ${HANDLER_NAME}(e, url)} {...rest}>x</Link>`, 'a spread after onClick can replace the handler'],
    ['a target computed at runtime', `<Link href={url} target={t} onClick={e => ${HANDLER_NAME}(e, url)}>x</Link>`, 'target is not a literal, so this scan cannot tell whether it opens a new tab'],
  ])('rejects %s', (_label, jsx, expected) => {
    expect(problems(jsx)).toEqual([expected])
  })

  it('rejects a same-named function that is not the handler module\'s', () => {
    expect(problems(`<a href={u} target="_blank" onClick={e => ${HANDLER_NAME}(e, u)}>x</a>`,
      `const ${HANDLER_NAME} = () => {}\n`)).toEqual([`onClick never calls ${HANDLER_NAME}`])
  })

  it('ignores an element written inside a JSX comment, and a link that opens in place', () => {
    expect(probe(`<div>{/* <a href={u} target="_blank">x</a> */}<a href="#top">top</a></div>`).sites).toEqual([])
  })

  it('counts a "_blank" that is not a JSX target, and only that', () => {
    const found = probe(`<a {...{ target: '_blank' }} href={u}>x</a>`)
    expect(found.sites).toEqual([])
    expect(found.others.map(o => o.text)).toEqual(['_blank'])
    expect(probe(`<a href={u} target="_blank" onClick={e => ${HANDLER_NAME}(e, u)}>x</a>`).others).toEqual([])
  })

  it('catches one handler removed from a real file (LifeListTable.tsx)', () => {
    const file = 'components/LifeListTable.tsx'
    const source = readFileSync(`${SRC}${file}`, 'utf8')
    const handler = `onClick={e => ${HANDLER_NAME}(e, photoHref)}`
    expect(source.split(handler)).toHaveLength(2)
    const before = analyse(file, source).sites
    const after = analyse(file, source.replace(handler, '')).sites
    expect(before.filter(s => s.problem !== null)).toEqual([])
    expect(after.filter(s => s.problem !== null).map(s => s.problem)).toEqual(['no onClick'])
    expect(after).toHaveLength(before.length)
  })
})
