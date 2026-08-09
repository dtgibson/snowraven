// The shared top-level-rule parser (extracted for the third guard that needs it,
// per CLAUDE.md). Its three load-bearing properties are asserted here against
// fixtures, so the stylesheet guards that consume it can assert about globals.css
// rather than about their own plumbing.
//
// Each case below is written against a SPECIFIC wrong parser: a substring/regex
// match over the raw text (case 1), a parser that walks into at-rule bodies
// (case 2), and one that does not strip comments before brace-walking (case 3).
import { describe, it, expect } from 'vitest'
import { parseTopLevelRules } from './cssTopLevelRules'

describe('parseTopLevelRules', () => {
  it('keys rules by their exact whitespace-normalized selector', () => {
    const rules = parseTopLevelRules('.a { color: red; }\n.b   .c  {\n  gap: 1px;\n}\n')
    expect([...rules.keys()]).toEqual(['.a', '.b .c'])
    expect(rules.get('.a')).toContain('color: red')
    expect(rules.get('.b .c')).toContain('gap: 1px')
  })

  it('distinguishes a base selector from a gated descendant form of it', () => {
    // The substring trap this parser exists to defeat. `.sr-x` appears inside
    // `.sr-ios-app .sr-x`, so a regex looking for the base rule matches the
    // gated one and a "the base carries no env()" assertion tests the wrong
    // body — exactly backwards, since the gated rule is where env() belongs.
    const rules = parseTopLevelRules(
      '.sr-x { top: 16px; }\n.sr-ios-app .sr-x { top: env(safe-area-inset-top, 0px); }\n',
    )
    expect(rules.get('.sr-x')).not.toContain('env(')
    expect(rules.get('.sr-ios-app .sr-x')).toContain('env(')
  })

  it('skips at-rule blocks whole, including at-rules nested inside them', () => {
    const rules = parseTopLevelRules(
      [
        '.keep { color: red; }',
        '@media (max-width: 640px) { .phone-only { display: block; } }',
        '@media (min-width: 1024px) { @supports (gap: 1px) { .nested { gap: 1px; } } }',
        '@container (min-width: 152px) { .in-container { display: block; } }',
        '.also-keep { color: blue; }',
      ].join('\n'),
    )
    expect([...rules.keys()]).toEqual(['.keep', '.also-keep'])
  })

  it('splits comma-separated selector groups, each keying the shared body', () => {
    const rules = parseTopLevelRules('.a,\n.b .c { scroll-margin-top: 3rem; }')
    expect(rules.get('.a')).toContain('scroll-margin-top: 3rem')
    expect(rules.get('.b .c')).toContain('scroll-margin-top: 3rem')
  })

  it('strips comments before the brace walk, including a comment containing a brace', () => {
    // globals.css really does contain one. Left in place it desynchronizes the
    // depth counter and every rule after it is keyed by garbage.
    const rules = parseTopLevelRules(
      '/* body { padding: 0 } is preflight, not ours */\n.after { color: red; }',
    )
    expect([...rules.keys()]).toEqual(['.after'])
  })

  it('does not treat a declaration value containing a brace-free at-word as an at-rule', () => {
    // Guards the `startsWith('@')` test against being applied to a selector that
    // merely follows an at-rule, e.g. after a @media block closes.
    const rules = parseTopLevelRules('@media print { .p { display: none; } }\n.after { gap: 0; }')
    expect([...rules.keys()]).toEqual(['.after'])
  })
})
