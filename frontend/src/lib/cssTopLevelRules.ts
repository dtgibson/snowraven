// Shared stylesheet parser for the guards that assert a rule applies at ALL
// viewport widths.
//
// TEST-ONLY. Nothing in the app imports this, so it is never bundled; it lives
// in src/lib rather than inside a test file because CLAUDE.md records that a
// third guard needing this shape should share ONE helper instead of deriving a
// fourth parser. This is that helper: `iosChrome.test.ts` (the Help overlay +
// the `.sr-skip-link` safe-area guard) and `mapIosFullscreen.test.ts` (the map
// fullscreen panel) both read globals.css through it.
//
// Three properties are load-bearing, and a substring or regex match over the
// raw stylesheet has none of them:
//
//  1. EXACT selector keys, so `.sr-help-panel` and `.sr-ios-app .sr-help-panel`
//     are distinguishable. A substring match finds the base selector INSIDE the
//     gated one, so a "the ungated base rule carries no env()" assertion would
//     resolve to whichever of the two comes first in the file — the assertion
//     carrying the teeth would silently be testing the other rule.
//  2. At-rule blocks are skipped WHOLE, so a rule DRY-consolidated into the
//     ≤640 phone tier disappears from the map and the guard fails, rather than
//     passing while every width above 640 (iPad) is left uncovered.
//  3. Comments are stripped first. globals.css contains a comment with a brace
//     in it, which would otherwise desynchronize the brace walk.
//  4. A top-level `;` ends a selector, so a `;`-terminated at-rule does not
//     swallow the rule after it. globals.css opens with `@import "tailwindcss";`,
//     and without this the parser read the whole of `@import "tailwindcss"; :root`
//     as one selector, saw the leading `@`, and dropped it — so `:root` was
//     absent from the map and any guard reaching for a token there got
//     `undefined` and passed vacuously.

/**
 * Every TOP-LEVEL rule in a stylesheet, keyed by its whitespace-normalized
 * selector. Comma-separated selector groups are split, so each individual
 * selector keys the group's shared declaration body.
 *
 * Rules nested inside any at-rule (`@media`, `@supports`, `@container`, and any
 * at-rule nested within those) are absent from the result by construction.
 */
export function parseTopLevelRules(src: string): Map<string, string> {
  const clean = src.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules = new Map<string, string>()
  let i = 0
  let selStart = 0
  while (i < clean.length) {
    // Only ever reached OUTSIDE a block (the walk below jumps whole blocks), so
    // a `;` here always terminates a top-level statement: `@import …;`,
    // `@charset …;`, `@layer a, b;`.
    if (clean[i] === ';') {
      i++
      selStart = i
      continue
    }
    if (clean[i] !== '{') {
      i++
      continue
    }
    let depth = 1
    let j = i + 1
    while (j < clean.length && depth > 0) {
      if (clean[j] === '{') depth++
      else if (clean[j] === '}') depth--
      j++
    }
    const selector = clean.slice(selStart, i).trim()
    if (!selector.startsWith('@')) {
      const body = clean.slice(i + 1, j - 1)
      for (const one of selector.split(',')) rules.set(one.trim().replace(/\s+/g, ' '), body)
    }
    i = j
    selStart = j
  }
  return rules
}

import * as cssTree from 'css-tree'
import type {
  Atrule,
  Block,
  CssLocation,
  CssNode,
  Declaration,
  FunctionNode,
  List,
  Raw,
  Rule,
  Scope,
  Selector,
  SelectorList,
  SyntaxConfig,
} from 'css-tree'

/** One style-rule occurrence. Duplicate selectors remain duplicate records. */
export interface CssRuleOccurrence {
  selector: string
  body: string
  atRules: string[]
}

/** One AST-confirmed declaration whose value reads a safe-area environment variable. */
export interface CssSafeAreaDeclarationOccurrence extends CssRuleOccurrence {
  property: string
  safeAreaVariables: string[]
}

type Relation = 'descendant' | 'child' | 'adjacent' | 'sibling' | 'column'

interface SelectorAtom {
  kind: 'class' | 'class-insensitive' | 'nesting-root' | 'scope-root'
  name?: string
}

interface SelectorNode {
  atoms: SelectorAtom[]
}

interface SelectorEdge {
  from: number
  to: number
  relation: Relation
}

/**
 * One selector alternative as a directed constraint graph. Functional selector
 * branches can have their own ancestor chain which converges on the compound
 * containing `:is()`/`:where()`, so a flat list cannot preserve their meaning.
 */
interface SelectorPath {
  nodes: SelectorNode[]
  edges: SelectorEdge[]
  entry: number
  subject: number
  leadingRelation: Relation | null
}

interface RuleRecord {
  occurrence: CssRuleOccurrence
  paths: SelectorPath[]
  scopePaths: SelectorPath[] | null
  declarations: SafeAreaDeclaration[]
}

interface SafeAreaDeclaration {
  property: string
  safeAreaVariables: string[]
}

interface WalkState {
  atRules: string[]
  parentPaths: SelectorPath[] | null
  scopePaths: SelectorPath[] | null
}

interface ParserInternals {
  tokenType: number
  tokenIndex: number
  tokenCount: number
  tokenStart: number
  eof: boolean
  source: string
  createList(): List<CssNode>
  eat(type: number): void
  next(): void
  isDelim(code: number): boolean
  getTokenType(index: number): number
  getTokenStart(index: number): number
  getTokenEnd(index: number): number
  getBlockTokenPairIndex(index: number): number
  getLocation(start: number, end: number): CssLocation | null
  parseWithFallback<T extends CssNode>(
    consumer: (...args: never[]) => T,
    fallback: (...args: never[]) => CssNode,
  ): T | CssNode
  Atrule(isStyleBlock: boolean): Atrule
  Rule(): Rule
  Declaration(): Declaration
  Raw(consumeUntil: ((code: number) => number) | null, excludeWhitespace: boolean): Raw
  consumeUntilSemicolonIncluded(code: number): number
}

interface SelectorRecognizer {
  getNode(this: ParserInternals, context?: unknown): CssNode | undefined
  onWhiteSpace?: unknown
}

interface InternalSyntaxConfig extends Omit<SyntaxConfig, 'node'> {
  node: Record<string, unknown>
  scope: Record<string, unknown> & { Selector: SelectorRecognizer }
}

const {
  AtKeyword,
  Comment,
  Delim,
  Function: FunctionToken,
  Ident,
  LeftCurlyBracket,
  LeftParenthesis,
  LeftSquareBracket,
  RightCurlyBracket,
  Semicolon,
  WhiteSpace,
} = cssTree.tokenTypes

const AMPERSAND = 0x26
const VERTICAL_LINE = 0x7c

function consumeRawBlock(this: ParserInternals): Raw {
  return this.Raw(null, true)
}

function consumeRule(this: ParserInternals): CssNode {
  return this.parseWithFallback(this.Rule, consumeRawBlock.bind(this))
}

function consumeRawDeclaration(this: ParserInternals): Raw {
  return this.Raw(this.consumeUntilSemicolonIncluded, true)
}

function consumeDeclaration(this: ParserInternals): CssNode {
  if (this.tokenType === Semicolon) return consumeRawDeclaration.call(this)
  const node = this.parseWithFallback(this.Declaration, consumeRawDeclaration.bind(this))
  if (this.tokenType === Semicolon) this.next()
  return node
}

/**
 * css-tree 3.2 implements explicit `&` nesting, but still recovers valid
 * implicit nesting as Raw. A style-block item with a top-level `{` before its
 * terminator is a rule; balanced functions/brackets in declaration values do
 * not count. Custom-property values intentionally remain declarations.
 */
function hasNestedRuleAhead(this: ParserInternals): boolean {
  let first = this.tokenIndex
  while (this.getTokenType(first) === WhiteSpace || this.getTokenType(first) === Comment) first++
  if (this.getTokenType(first) === Ident) {
    const ident = this.source.slice(this.getTokenStart(first), this.getTokenEnd(first))
    if (cssTree.ident.decode(ident).startsWith('--')) return false
  }

  for (let i = first; i < this.tokenCount; i++) {
    const type = this.getTokenType(i)
    if (type === WhiteSpace || type === Comment) continue
    if (type === FunctionToken || type === LeftParenthesis || type === LeftSquareBracket) {
      const pair = this.getBlockTokenPairIndex(i)
      if (pair > i) {
        i = pair
        continue
      }
    }
    if (type === LeftCurlyBracket) return true
    if (type === Semicolon || type === RightCurlyBracket) return false
  }
  return false
}

function parseBlock(this: ParserInternals, isStyleBlock: boolean): Block {
  const start = this.tokenStart
  const children = this.createList()
  this.eat(LeftCurlyBracket)

  while (!this.eof) {
    switch (this.tokenType) {
      case RightCurlyBracket:
        this.eat(RightCurlyBracket)
        return { type: 'Block', loc: this.getLocation(start, this.tokenStart) ?? undefined, children }
      case WhiteSpace:
      case Comment:
        this.next()
        break
      case AtKeyword:
        children.push(this.parseWithFallback(
          this.Atrule.bind(this, isStyleBlock),
          consumeRawBlock.bind(this),
        ))
        break
      default:
        children.push(
          isStyleBlock && (this.isDelim(AMPERSAND) || hasNestedRuleAhead.call(this))
            ? consumeRule.call(this)
            : isStyleBlock
              ? consumeDeclaration.call(this)
              : consumeRule.call(this),
        )
    }
  }

  return { type: 'Block', loc: this.getLocation(start, this.tokenStart) ?? undefined, children }
}

function extendSyntax(config: InternalSyntaxConfig): InternalSyntaxConfig {
  const baseSelector = config.scope.Selector
  const baseBlock = config.node.Block as Record<string, unknown>
  return {
    ...config,
    node: {
      ...config.node,
      Block: {
        ...baseBlock,
        parse: parseBlock as unknown as (...args: unknown[]) => Block,
      },
    },
    scope: {
      ...config.scope,
      Selector: {
        ...baseSelector,
        getNode(this: ParserInternals, context?: unknown): CssNode | undefined {
          const next = this.tokenIndex + 1
          if (this.isDelim(VERTICAL_LINE)
            && this.getTokenType(next) === Delim
            && this.source.charCodeAt(this.getTokenStart(next)) === VERTICAL_LINE) {
            const start = this.tokenStart
            this.next()
            this.next()
            return {
              type: 'Combinator',
              loc: this.getLocation(start, this.tokenStart) ?? undefined,
              name: '||',
            }
          }
          return baseSelector.getNode.call(this, context)
        },
      },
    },
  }
}

// css-tree's runtime fork config includes parser scopes, while its public type
// exposes only the documented extension subset.
const cssSyntax = cssTree.fork(
  extendSyntax as unknown as (config: SyntaxConfig) => SyntaxConfig,
)

function failClosed(message: string): never {
  throw new Error(`Cannot safely inspect stylesheet: ${message}`)
}

function decodedIdent(name: string): string {
  return cssTree.ident.decode(name)
}

function locationSlice(src: string, loc: CssLocation | undefined): string {
  if (!loc) return failClosed('parser did not retain source locations')
  return src.slice(loc.start.offset, loc.end.offset)
}

/** css-tree deliberately recovers unmatched EOF delimiters; guards must not. */
function assertLexicallyBalanced(src: string): void {
  const stack: number[] = []
  let quote = 0
  let comment = false
  for (let i = 0; i < src.length; i++) {
    const code = src.charCodeAt(i)
    if (comment) {
      if (code === 0x2a && src.charCodeAt(i + 1) === 0x2f) {
        comment = false
        i++
      }
      continue
    }
    if (quote) {
      if (code === 0x5c) i++
      else if (code === quote) quote = 0
      continue
    }
    if (code === 0x5c) {
      i++
      continue
    }
    if (code === 0x2f && src.charCodeAt(i + 1) === 0x2a) {
      comment = true
      i++
    } else if (code === 0x22 || code === 0x27) {
      quote = code
    } else if (code === 0x7b || code === 0x28 || code === 0x5b) {
      stack.push(code)
    } else if (code === 0x7d || code === 0x29 || code === 0x5d) {
      const expected = code === 0x7d ? 0x7b : code === 0x29 ? 0x28 : 0x5b
      if (stack.pop() !== expected) failClosed(`unbalanced delimiter at offset ${i}`)
    }
  }
  if (comment) failClosed('unterminated comment')
  if (quote) failClosed('unterminated string')
  if (stack.length > 0) failClosed('unterminated block or function')
}

function relationFor(name: string): Relation {
  switch (name) {
    case ' ':
      return 'descendant'
    case '>':
      return 'child'
    case '+':
      return 'adjacent'
    case '~':
      return 'sibling'
    case '||':
      return 'column'
    default:
      return failClosed(`unsupported combinator ${JSON.stringify(name)}`)
  }
}

function classAttributeAtoms(node: CssNode): SelectorAtom[] {
  if (node.type !== 'AttributeSelector' || decodedIdent(node.name.name).toLowerCase() !== 'class') {
    return []
  }
  if (node.matcher !== '=' && node.matcher !== '~=') return []
  const value = node.value?.type === 'Identifier'
    ? decodedIdent(node.value.name)
    : node.value?.type === 'String'
      ? node.value.value
      : null
  if (value === null) return []

  const names = node.matcher === '='
    ? value.split(/[\t\n\f\r ]+/).filter(Boolean)
    : [value]
  const kind = node.flags?.toLowerCase() === 'i' ? 'class-insensitive' : 'class'
  return names.map(name => ({ kind, name }))
}

function selectorListChild(node: CssNode): SelectorList | null {
  if (node.type !== 'PseudoClassSelector' || !node.children) return null
  for (const child of node.children) {
    if (child.type === 'SelectorList') return child
    if (child.type === 'Raw') failClosed(`unsupported selector function :${decodedIdent(node.name)}`)
  }
  return null
}

function nthSelectorListChild(node: CssNode): SelectorList | null {
  if (node.type !== 'PseudoClassSelector' || !node.children) return null
  for (const child of node.children) {
    if (child.type === 'Nth' && child.selector) return child.selector
  }
  return null
}

// This parser is a test-only release guard. 4,096 leaves ample headroom for
// ordinary authored selectors and deliberate fixtures while bounding accidental
// exponential expansion.
const MAX_SELECTOR_PATH_ALTERNATIVES = 4_096

function assertAlternativeCount(count: number, context: string): void {
  if (count > MAX_SELECTOR_PATH_ALTERNATIVES) {
    failClosed(
      `selector path expansion exceeds ${MAX_SELECTOR_PATH_ALTERNATIVES} alternatives (${context})`,
    )
  }
}

function assertProductBudget(left: number, right: number, context: string): void {
  if (left !== 0 && right > Math.floor(MAX_SELECTOR_PATH_ALTERNATIVES / left)) {
    assertAlternativeCount(MAX_SELECTOR_PATH_ALTERNATIVES + 1, context)
  }
}

function appendAlternatives(
  target: SelectorPath[],
  additions: SelectorPath[],
  context: string,
): void {
  assertAlternativeCount(target.length + additions.length, context)
  for (const addition of additions) target.push(addition)
}

function emptySelectorPath(): SelectorPath {
  return {
    nodes: [{ atoms: [] }],
    edges: [],
    entry: 0,
    subject: 0,
    leadingRelation: null,
  }
}

function clonePath(path: SelectorPath): SelectorPath {
  return {
    nodes: path.nodes.map(node => ({ atoms: [...node.atoms] })),
    edges: path.edges.map(edge => ({ ...edge })),
    entry: path.entry,
    subject: path.subject,
    leadingRelation: path.leadingRelation,
  }
}

function appendStep(path: SelectorPath, relation: Relation | null): SelectorPath {
  const copied = clonePath(path)
  const only = copied.nodes[0]
  if (copied.nodes.length === 1 && copied.edges.length === 0 && only.atoms.length === 0) {
    copied.leadingRelation = relation
    return copied
  }

  const next = copied.nodes.length
  copied.nodes.push({ atoms: [] })
  copied.edges.push({
    from: copied.subject,
    to: next,
    relation: relation ?? 'descendant',
  })
  copied.subject = next
  return copied
}

/**
 * Compose a functional selector branch with its containing compound. The
 * branch's RIGHTMOST subject is the same element as the outer compound; its
 * earlier compounds remain independent constraints leading into that subject.
 */
function composeFunctionalPath(prefix: SelectorPath, suffix: SelectorPath): SelectorPath {
  if (suffix.leadingRelation !== null) {
    return failClosed('functional selector branch starts with a combinator')
  }

  const out = clonePath(prefix)
  const indexMap = new Map<number, number>([[suffix.subject, out.subject]])
  out.nodes[out.subject].atoms.push(...suffix.nodes[suffix.subject].atoms)

  for (let index = 0; index < suffix.nodes.length; index++) {
    if (index === suffix.subject) continue
    indexMap.set(index, out.nodes.length)
    out.nodes.push({ atoms: [...suffix.nodes[index].atoms] })
  }
  for (const edge of suffix.edges) {
    const from = indexMap.get(edge.from)
    const to = indexMap.get(edge.to)
    if (from === undefined || to === undefined) return failClosed('incomplete selector composition')
    out.edges.push({ from, to, relation: edge.relation })
  }
  return out
}

function cartesianAppend(prefixes: SelectorPath[], suffixes: SelectorPath[]): SelectorPath[] {
  assertProductBudget(prefixes.length, suffixes.length, 'functional selector')
  const out: SelectorPath[] = []
  for (const prefix of prefixes) {
    for (const suffix of suffixes) out.push(composeFunctionalPath(prefix, suffix))
  }
  return out
}

function selectorListPaths(list: SelectorList): SelectorPath[] {
  const out: SelectorPath[] = []
  for (const node of list.children) {
    if (node.type !== 'Selector') return failClosed(`unexpected ${node.type} in selector list`)
    appendAlternatives(out, selectorPaths(node), 'selector list')
  }
  return out
}

function containsNestingSelector(node: CssNode): boolean {
  let found = false
  cssTree.walk(node, child => {
    if (child.type === 'NestingSelector') found = true
  })
  return found
}

function selectorPaths(selector: Selector): SelectorPath[] {
  let paths: SelectorPath[] = [emptySelectorPath()]
  let pendingRelation: Relation | null = null

  for (const node of selector.children) {
    if (node.type === 'Combinator') {
      if (pendingRelation !== null) return failClosed('consecutive selector combinators')
      pendingRelation = relationFor(node.name)
      continue
    }

    if (node.type === 'NestingSelector') {
      if (pendingRelation !== null) {
        paths = paths.map(path => appendStep(path, pendingRelation))
        pendingRelation = null
      }
      for (const path of paths) path.nodes[path.subject].atoms.push({ kind: 'nesting-root' })
      continue
    }

    const pseudoName = node.type === 'PseudoClassSelector'
      ? decodedIdent(node.name).toLowerCase()
      : null
    const directBranches = pseudoName === 'is' || pseudoName === 'where'
      ? selectorListChild(node)
      : null
    const nthBranches = pseudoName === 'nth-child' || pseudoName === 'nth-last-child'
      ? nthSelectorListChild(node)
      : null
    const branches = directBranches ?? nthBranches
    if (branches) {
      const expanded = selectorListPaths(branches)
      if (pendingRelation !== null) {
        paths = paths.map(path => appendStep(path, pendingRelation))
        pendingRelation = null
      }
      paths = cartesianAppend(paths, expanded)
      continue
    }
    if ((pseudoName === 'is' || pseudoName === 'where') && !directBranches) {
      return failClosed(`:${pseudoName} has no selector list`)
    }

    if (pendingRelation !== null) {
      paths = paths.map(path => appendStep(path, pendingRelation))
      pendingRelation = null
    }

    for (const path of paths) {
      const atoms = path.nodes[path.subject].atoms
      if (node.type === 'ClassSelector') {
        atoms.push({ kind: 'class', name: decodedIdent(node.name) })
      } else {
        atoms.push(...classAttributeAtoms(node))
      }

      if (node.type === 'PseudoClassSelector') {
        if (containsNestingSelector(node)) {
          return failClosed(`unsupported nesting selector inside :${pseudoName ?? node.name}`)
        }
        if (pseudoName === 'scope') atoms.push({ kind: 'scope-root' })
        else if (pseudoName !== 'not' && pseudoName !== 'has') {
          const nested = selectorListChild(node)
          if (nested) return failClosed(`unsupported functional selector :${pseudoName}`)
        }
      }
    }
  }

  if (pendingRelation !== null) return failClosed('selector ends with a combinator')
  return paths
}

function replaceRootAtoms(
  path: SelectorPath,
  roots: SelectorPath[],
  kind: 'nesting-root' | 'scope-root',
): SelectorPath[] {
  const rootIndexes = path.nodes.flatMap((node, index) =>
    node.atoms.some(atom => atom.kind === kind) ? [index] : [],
  )
  const rootCount = path.nodes.reduce(
    (count, node) => count + node.atoms.filter(atom => atom.kind === kind).length,
    0,
  )
  if (rootIndexes.length === 0) return [clonePath(path)]
  if (rootIndexes.length > 1) return failClosed('multiple nesting/scope selectors are unsupported')
  if (rootCount > 1) return failClosed('multiple nesting/scope selectors are unsupported')
  assertAlternativeCount(roots.length, 'nesting/scope substitution')

  const index = rootIndexes[0]
  const placeholder = path.nodes[index]
  const localAtoms = placeholder.atoms.filter(atom => atom.kind !== kind)
  const out: SelectorPath[] = []

  for (const root of roots) {
    if (root.nodes.length === 0) return failClosed('empty nesting parent')
    const substituted = clonePath(root)
    const indexMap = new Map<number, number>([[index, substituted.subject]])
    substituted.nodes[substituted.subject].atoms.push(...localAtoms)

    for (let local = 0; local < path.nodes.length; local++) {
      if (local === index) continue
      indexMap.set(local, substituted.nodes.length)
      substituted.nodes.push({ atoms: [...path.nodes[local].atoms] })
    }
    for (const edge of path.edges) {
      const from = indexMap.get(edge.from)
      const to = indexMap.get(edge.to)
      if (from === undefined || to === undefined) return failClosed('incomplete root substitution')
      substituted.edges.push({ from, to, relation: edge.relation })
    }

    const mappedEntry = indexMap.get(path.entry)
    const mappedSubject = indexMap.get(path.subject)
    if (mappedEntry === undefined || mappedSubject === undefined) {
      return failClosed('incomplete root anchors')
    }
    substituted.entry = path.entry === index ? root.entry : mappedEntry
    substituted.subject = mappedSubject
    substituted.leadingRelation = path.entry === index
      ? root.leadingRelation
      : path.leadingRelation
    out.push(substituted)
  }
  return out
}

function prependPath(parent: SelectorPath, child: SelectorPath): SelectorPath {
  const out = clonePath(parent)
  const indexMap = new Map<number, number>()
  for (let index = 0; index < child.nodes.length; index++) {
    indexMap.set(index, out.nodes.length)
    out.nodes.push({ atoms: [...child.nodes[index].atoms] })
  }
  for (const edge of child.edges) {
    const from = indexMap.get(edge.from)
    const to = indexMap.get(edge.to)
    if (from === undefined || to === undefined) return failClosed('incomplete nested selector')
    out.edges.push({ from, to, relation: edge.relation })
  }
  const childEntry = indexMap.get(child.entry)
  const childSubject = indexMap.get(child.subject)
  if (childEntry === undefined || childSubject === undefined) return failClosed('missing child anchors')
  out.edges.push({
    from: out.subject,
    to: childEntry,
    relation: child.leadingRelation ?? 'descendant',
  })
  out.subject = childSubject
  return out
}

function resolveNestedPaths(paths: SelectorPath[], parents: SelectorPath[] | null): SelectorPath[] {
  const hasRoot = paths.some(path =>
    path.nodes.some(node => node.atoms.some(atom => atom.kind === 'nesting-root')),
  )
  if (!parents) {
    if (hasRoot) return failClosed('nesting selector has no parent rule')
    return paths
  }

  let outputCount = 0
  for (const path of paths) {
    const pathHasRoot = path.nodes.some(node =>
      node.atoms.some(atom => atom.kind === 'nesting-root'),
    )
    outputCount += pathHasRoot ? parents.length : hasRoot ? 1 : parents.length
    assertAlternativeCount(outputCount, 'nested selector')
  }

  const out: SelectorPath[] = []
  for (const path of paths) {
    if (path.nodes.some(node => node.atoms.some(atom => atom.kind === 'nesting-root'))) {
      appendAlternatives(out, replaceRootAtoms(path, parents, 'nesting-root'), 'nested selector')
    } else if (hasRoot) {
      out.push(clonePath(path))
    } else {
      for (const parent of parents) out.push(prependPath(parent, path))
    }
  }
  return out
}

function scopeRootPaths(atrule: Atrule): SelectorPath[] | null {
  if (decodedIdent(atrule.name).toLowerCase() !== 'scope') return null
  if (!atrule.prelude) return [emptySelectorPath()]
  if (atrule.prelude.type === 'Raw') return failClosed('unparsed @scope prelude')
  for (const child of atrule.prelude.children) {
    if (child.type !== 'Scope') continue
    const scope = child as Scope
    if (!scope.root) return [emptySelectorPath()]
    if (scope.root.type === 'Raw') return failClosed('unparsed @scope root')
    return selectorListPaths(scope.root)
  }
  return failClosed('@scope prelude has no scope root')
}

function combineScopePaths(
  outer: SelectorPath[] | null,
  inner: SelectorPath[] | null,
): SelectorPath[] | null {
  if (!inner) return outer
  if (!outer) return inner
  assertProductBudget(inner.length, outer.length, 'nested @scope roots')
  const out: SelectorPath[] = []
  for (const innerPath of inner) {
    if (innerPath.nodes.some(node => node.atoms.some(atom => atom.kind === 'scope-root'))) {
      appendAlternatives(out, replaceRootAtoms(innerPath, outer, 'scope-root'), 'nested @scope roots')
      continue
    }
    for (const outerPath of outer) out.push(prependPath(outerPath, innerPath))
  }
  return out
}

function safeAreaDeclaration(declaration: Declaration): SafeAreaDeclaration | null {
  if (declaration.value.type === 'Raw') return failClosed(`unparsed value for ${declaration.property}`)
  const safeAreaVariables: string[] = []
  cssTree.walk(declaration.value, node => {
    if (node.type !== 'Function' || decodedIdent(node.name).toLowerCase() !== 'env') return
    const fn = node as FunctionNode
    const first = fn.children.first
    if (first?.type !== 'Identifier') return
    const variable = decodedIdent(first.name).toLowerCase()
    if (/^safe-area-/.test(variable)) safeAreaVariables.push(variable)
  })
  return safeAreaVariables.length > 0
    ? { property: decodedIdent(declaration.property).toLowerCase(), safeAreaVariables }
    : null
}

function safeAreaDeclarations(block: Block): SafeAreaDeclaration[] {
  const out: SafeAreaDeclaration[] = []
  for (const node of block.children) {
    if (node.type === 'Declaration') {
      const declaration = safeAreaDeclaration(node)
      if (declaration) out.push(declaration)
    }
    if (node.type === 'Atrule' && node.block) {
      const name = decodedIdent(node.name).toLowerCase()
      // Descriptor/keyframe declarations do not inherit the qualified selector.
      if (/^(?:-[a-z]+-)?keyframes$/.test(name)) continue
      if (['counter-style', 'font-face', 'font-feature-values', 'font-palette-values',
        'page', 'property', 'viewport'].includes(name)) continue
      out.push(...safeAreaDeclarations(node.block))
    }
  }
  return out
}

function atRuleLabel(src: string, atrule: Atrule): string {
  if (!atrule.loc) return failClosed('at-rule has no source location')
  const end = atrule.block?.loc?.start.offset ?? atrule.loc.end.offset
  return src.slice(atrule.loc.start.offset, end).trim().replace(/\s+/g, ' ').replace(/\s*\{$/, '')
}

function parseRuleRecords(src: string): RuleRecord[] {
  assertLexicallyBalanced(src)
  let recovery: string | null = null
  const ast = cssSyntax.parse(src, {
    positions: true,
    parseCustomProperty: true,
    onParseError(error, fallback) {
      recovery = `${error.message} near offset ${error.offset} (${fallback.type})`
    },
  })
  if (recovery) return failClosed(recovery)
  if (ast.type !== 'StyleSheet') return failClosed(`unexpected root ${ast.type}`)

  cssTree.walk(ast, node => {
    if (node.type === 'Raw') failClosed(`unparsed CSS near offset ${node.loc?.start.offset ?? 'unknown'}`)
  })

  const out: RuleRecord[] = []

  function walkBlock(block: Block, state: WalkState, keyframes: boolean): void {
    for (const node of block.children) {
      if (node.type === 'Rule') {
        if (keyframes) continue
        if (node.prelude.type === 'Raw') failClosed('unparsed rule selector')
        const paths: SelectorPath[] = []
        const declarations = safeAreaDeclarations(node.block)
        for (const selectorNode of node.prelude.children) {
          if (selectorNode.type !== 'Selector') failClosed('non-selector in selector list')
          const local = resolveNestedPaths(selectorPaths(selectorNode), state.parentPaths)
          appendAlternatives(paths, local, 'qualified selector list')
          const selector = locationSlice(src, selectorNode.loc).trim().replace(/\s+/g, ' ')
          const bodyStart = node.block.loc?.start.offset
          const bodyEnd = node.block.loc?.end.offset
          if (bodyStart === undefined || bodyEnd === undefined) failClosed('rule block has no location')
          out.push({
            occurrence: {
              selector,
              body: src.slice(bodyStart + 1, bodyEnd - 1),
              atRules: [...state.atRules],
            },
            paths: local,
            scopePaths: state.scopePaths,
            declarations,
          })
        }
        walkBlock(node.block, { ...state, parentPaths: paths }, false)
      } else if (node.type === 'Atrule' && node.block) {
        const name = decodedIdent(node.name).toLowerCase()
        const nextScope = combineScopePaths(state.scopePaths, scopeRootPaths(node))
        walkBlock(node.block, {
          atRules: [...state.atRules, atRuleLabel(src, node)],
          parentPaths: state.parentPaths,
          scopePaths: nextScope,
        }, /^(?:-[a-z]+-)?keyframes$/.test(name))
      }
    }
  }

  walkBlock(ast as unknown as { children: List<CssNode> } as Block, {
    atRules: [],
    parentPaths: null,
    scopePaths: null,
  }, false)

  // Scope roots are structural ancestors of every rule in their block.
  for (const record of out) {
    // State is folded during collection below; kept here as a defensive invariant.
    if (record.paths.length === 0) failClosed('selector resolved to no concrete path')
  }
  return out
}

function nodeHasClass(node: SelectorNode, className: string): boolean {
  return node.atoms.some(atom => atom.kind === 'class' && atom.name === className)
}

function nodeMayHaveSurface(node: SelectorNode, surfaceClass: string): boolean {
  return nodeHasClass(node, surfaceClass)
    || node.atoms.some(atom =>
      atom.kind === 'class-insensitive' && atom.name?.toLowerCase() === surfaceClass.toLowerCase(),
    )
}

function isAncestorEdge(edge: SelectorEdge): boolean {
  return edge.relation === 'descendant' || edge.relation === 'child'
}

function gatePrecedesNode(path: SelectorPath, target: number): boolean {
  const seen = new Set<number>()
  const pending = [target]
  while (pending.length > 0) {
    const current = pending.pop()
    if (current === undefined || seen.has(current)) continue
    seen.add(current)
    for (const edge of path.edges) {
      if (edge.to !== current) continue
      if (!isAncestorEdge(edge)) {
        if (edge.relation === 'adjacent' || edge.relation === 'sibling') pending.push(edge.from)
        continue
      }
      if (nodeHasClass(path.nodes[edge.from], 'sr-ios-app')) return true
      pending.push(edge.from)
    }
  }
  return false
}

function pathHasSurface(path: SelectorPath, surfaceClass: string): boolean {
  return path.nodes.some(node => nodeMayHaveSurface(node, surfaceClass))
}

function pathIsGated(path: SelectorPath, surfaceClass: string): boolean {
  const surfaces = path.nodes.flatMap((node, index) =>
    nodeMayHaveSurface(node, surfaceClass) ? [index] : [],
  )
  return surfaces.length > 0 && surfaces.every(surface => gatePrecedesNode(path, surface))
}

function recordPaths(record: RuleRecord): SelectorPath[] {
  if (!record.scopePaths) {
    if (record.paths.some(path =>
      path.nodes.some(node => node.atoms.some(atom => atom.kind === 'scope-root')),
    )) return failClosed(':scope selector has no active @scope root')
    return record.paths
  }
  assertProductBudget(record.scopePaths.length, record.paths.length, 'scoped selector')
  const out: SelectorPath[] = []
  for (const scope of record.scopePaths) {
    for (const path of record.paths) {
      if (path.nodes.some(node => node.atoms.some(atom => atom.kind === 'scope-root'))) {
        appendAlternatives(out, replaceRootAtoms(path, [scope], 'scope-root'), 'scoped selector')
        continue
      }
      out.push(prependPath(scope, path))
    }
  }
  return out
}

/** Every safe-area declaration on a surface, including at-rule-nested copies. */
export function findSafeAreaRules(src: string, surfaceClass: string): CssRuleOccurrence[] {
  return parseRuleRecords(src)
    .filter(record => record.declarations.length > 0 && recordPaths(record).some(path =>
      pathHasSurface(path, surfaceClass),
    ))
    .map(record => record.occurrence)
}

/** Safe-area declarations on a surface without the native-app ancestor gate. */
export function findUngatedSafeAreaRules(src: string, surfaceClass: string): CssRuleOccurrence[] {
  return parseRuleRecords(src)
    .filter(record => record.declarations.length > 0 && recordPaths(record).some(path =>
      pathHasSurface(path, surfaceClass) && !pathIsGated(path, surfaceClass),
    ))
    .map(record => record.occurrence)
}

/** AST-confirmed safe-area declarations on a surface, with decoded properties and variables. */
export function findSafeAreaDeclarations(
  src: string,
  surfaceClass: string,
): CssSafeAreaDeclarationOccurrence[] {
  return parseRuleRecords(src).flatMap(record => {
    if (!recordPaths(record).some(path =>
      pathHasSurface(path, surfaceClass),
    )) return []
    return record.declarations.map(declaration => ({
      ...record.occurrence,
      ...declaration,
    }))
  })
}

/** Every qualified rule, at any block-at-rule or native-nesting depth. */
export function parseRulesAtAnyDepth(src: string): CssRuleOccurrence[] {
  return parseRuleRecords(src).map(record => record.occurrence)
}
