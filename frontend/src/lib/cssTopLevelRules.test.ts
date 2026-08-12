// The shared top-level-rule parser (extracted for the third guard that needs it,
// per CLAUDE.md). Its three load-bearing properties are asserted here against
// fixtures, so the stylesheet guards that consume it can assert about globals.css
// rather than about their own plumbing.
//
// Each case below is written against a SPECIFIC wrong parser: a substring/regex
// match over the raw text (case 1), a parser that walks into at-rule bodies
// (case 2), and one that does not strip comments before brace-walking (case 3).
import { describe, it, expect } from 'vitest'
import {
  findSafeAreaRules,
  findUngatedSafeAreaRules,
  parseRulesAtAnyDepth,
  parseTopLevelRules,
} from './cssTopLevelRules'

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

  it('does not let a `;`-terminated at-rule swallow the rule that follows it', () => {
    // globals.css opens with `@import "tailwindcss";`, so before this the first
    // real rule in the file was parsed as part of the selector
    // `@import "tailwindcss"; :root`, seen to start with `@`, and dropped. The
    // failure was silent and vacuous: a guard asking for `:root` got `undefined`,
    // and with optional chaining it simply passed.
    const rules = parseTopLevelRules('@import "tailwindcss";\n:root { --sr-error: #D31F1F; }\n.a { gap: 0; }')
    expect([...rules.keys()]).toEqual([':root', '.a'])
    expect(rules.get(':root')).toContain('--sr-error')

    // The same for the other `;`-terminated at-rules, and two in a row.
    const layered = parseTopLevelRules('@charset "utf-8";\n@layer base, components;\n.b { gap: 1px; }')
    expect([...layered.keys()]).toEqual(['.b'])
  })

  it('does not treat a declaration value containing a brace-free at-word as an at-rule', () => {
    // Guards the `startsWith('@')` test against being applied to a selector that
    // merely follows an at-rule, e.g. after a @media block closes.
    const rules = parseTopLevelRules('@media print { .p { display: none; } }\n.after { gap: 0; }')
    expect([...rules.keys()]).toEqual(['.after'])
  })
})

describe('parseRulesAtAnyDepth', () => {
  it('keeps top-level and arbitrarily nested rule occurrences with their ancestry', () => {
    const rules = parseRulesAtAnyDepth([
      '@import "tailwindcss";',
      '.same { top: 0; }',
      '@supports (padding: max(0px, 1px)) {',
      '  @layer components {',
      '    @container card (min-width: 1px) {',
      '      .same { top: env(safe-area-inset-top, 0px); }',
      '    }',
      '  }',
      '}',
    ].join('\n'))

    expect(rules.filter(r => r.selector === '.same')).toEqual([
      { selector: '.same', body: ' top: 0; ', atRules: [] },
      {
        selector: '.same',
        body: ' top: env(safe-area-inset-top, 0px); ',
        atRules: [
          '@supports (padding: max(0px, 1px))',
          '@layer components',
          '@container card (min-width: 1px)',
        ],
      },
    ])
  })

  it('splits only selector-list commas and ignores comments and quoted braces', () => {
    const rules = parseRulesAtAnyDepth([
      '/* .fake { top: env(safe-area-inset-top); } */',
      '.a:is(.b, .c), [data-label="x,y}"] .d { content: "{"; top: 0; }',
    ].join('\n'))
    expect(rules.map(r => r.selector)).toEqual(['.a:is(.b, .c)', '[data-label="x,y}"] .d'])
    expect(rules.every(r => r.body.includes('content: "{"'))).toBe(true)
  })

  it('does not treat escaped structural characters as parser boundaries', () => {
    const rules = parseRulesAtAnyDepth(String.raw`
      .escaped\,comma, .escaped\{brace { color: red; }
      @media screen { .after { top: env(safe-area-inset-top); } }
    `)
    expect(rules.map(r => r.selector)).toEqual(['.escaped\\,comma', '.escaped\\{brace', '.after'])
  })
})

describe('safe-area absence scan', () => {
  const guardedSelectors = [
    ['sr-bc-matrix--pinned', '.sr-bc-matrix--pinned thead th'],
    ['sr-bc-matrix--pinned', '.sr-bc-matrix--pinned tbody th'],
    ['sr-bc-matrix--pinned', '.sr-bc-matrix--pinned tbody td'],
    ['sr-bc-matrix--pinned', '.sr-bc-matrix--pinned tbody th *'],
    ['sr-bc-matrix--pinned', '.sr-bc-matrix--pinned tbody td *'],
    ['sr-ll-table--pinned', '.sr-ll-table--pinned thead th'],
    ['sr-ll-table--pinned', '.sr-ll-table--pinned tbody th'],
    ['sr-ll-table--pinned', '.sr-ll-table--pinned tbody td'],
    ['sr-ll-table--pinned', '.sr-ll-table--pinned tbody th *'],
    ['sr-ll-table--pinned', '.sr-ll-table--pinned tbody td *'],
    ['sr-help-panel', '.sr-help-panel'],
    ['sr-help-toc', '.sr-help-toc'],
    ['sr-skip-link', '.sr-skip-link'],
    ['sr-skip-link', '.sr-skip-link:focus'],
    ['sr-map-fullscreen-panel', '.sr-map-fullscreen-panel'],
    ['sr-map-fab-cluster', '.sr-map-fab-cluster'],
  ]

  it.each(guardedSelectors)('finds top-level and nested ungated declarations for %s', (surface, selector) => {
    const top = `${selector} { top: env(safe-area-inset-top, 0px); }`
    const nested = `@supports (top: 0) { @layer components { ${top} } }`
    expect(findUngatedSafeAreaRules(top, surface)).toHaveLength(1)
    expect(findUngatedSafeAreaRules(nested, surface)).toHaveLength(1)
  })

  it.each(guardedSelectors)('allows the native-app-gated declaration for %s at either depth', (surface, selector) => {
    const gated = `.sr-ios-app ${selector} { top: env(safe-area-inset-top, 0px); }`
    expect(findUngatedSafeAreaRules(gated, surface)).toHaveLength(0)
    expect(findUngatedSafeAreaRules(`@container style(--compact: true) { ${gated} }`, surface))
      .toHaveLength(0)
  })

  it('can enforce a complete absence where even a gated declaration would compete', () => {
    const gated = '.sr-ios-app .sr-map-sidebar-overlay { padding-left: env(safe-area-inset-left); }'
    expect(findSafeAreaRules(gated, 'sr-map-sidebar-overlay')).toHaveLength(1)
    expect(findSafeAreaRules(`@media (orientation: landscape) { ${gated} }`, 'sr-map-sidebar-overlay'))
      .toHaveLength(1)
  })

  it('keeps each member of a mixed gated/ungated selector list independently visible', () => {
    const css = [
      '.sr-ios-app .sr-help-panel,',
      '.sr-help-panel[data-mode="compact,wide"] {',
      '  top: env(safe-area-inset-top, 0px);',
      '}',
    ].join('\n')
    expect(findUngatedSafeAreaRules(css, 'sr-help-panel').map(r => r.selector))
      .toEqual(['.sr-help-panel[data-mode="compact,wide"]'])
  })

  it('keeps duplicate occurrences so a later clean rule cannot hide an earlier hazard', () => {
    const css = [
      '.sr-help-panel { top: env(safe-area-inset-top, 0px); }',
      '.sr-help-panel { top: 0; }',
    ].join('\n')
    expect(findUngatedSafeAreaRules(css, 'sr-help-panel')).toHaveLength(1)
  })

  it('ignores quoted prose that merely spells an environment call', () => {
    const css = '.sr-help-panel::before { content: "env(safe-area-inset-top)"; }'
    expect(findUngatedSafeAreaRules(css, 'sr-help-panel')).toHaveLength(0)
  })

  it('recognizes only a real ancestor gate, not a later or functional mention', () => {
    const body = '{ top: env(safe-area-inset-top, 0px); }'
    expect(findUngatedSafeAreaRules(`.sr-ios-app .sr-help-panel ${body}`, 'sr-help-panel'))
      .toHaveLength(0)
    expect(findUngatedSafeAreaRules(`.sr-help-panel .sr-ios-app ${body}`, 'sr-help-panel'))
      .toHaveLength(1)
    expect(findUngatedSafeAreaRules(`.sr-help-panel:not(.sr-ios-app) ${body}`, 'sr-help-panel'))
      .toHaveLength(1)
    expect(findUngatedSafeAreaRules(`.other:has(.sr-ios-app) .sr-help-panel ${body}`, 'sr-help-panel'))
      .toHaveLength(1)
    expect(findUngatedSafeAreaRules(`.sr-ios-app + .sr-help-panel ${body}`, 'sr-help-panel'))
      .toHaveLength(1)
    expect(findUngatedSafeAreaRules(`.sr-ios-app ~ .sr-help-panel ${body}`, 'sr-help-panel'))
      .toHaveLength(1)
    expect(findUngatedSafeAreaRules(
      `.sr-help-panel .sr-ios-app .sr-help-panel ${body}`,
      'sr-help-panel',
    )).toHaveLength(1)
  })

  it('decodes equivalent CSS escape spellings before semantic matching', () => {
    expect(findUngatedSafeAreaRules(
      String.raw`.sr-help\2d panel { top: env(safe-area-inset-top); }`,
      'sr-help-panel',
    )).toHaveLength(1)
    expect(findUngatedSafeAreaRules(
      String.raw`.sr-help-panel { top: e\6ev(safe-area-inset-top); }`,
      'sr-help-panel',
    )).toHaveLength(1)
    expect(findUngatedSafeAreaRules(
      String.raw`.sr-help-panel { top: env(safe\2d area-inset-top); }`,
      'sr-help-panel',
    )).toHaveLength(1)
  })

  it('checks each :is() and :where() branch independently', () => {
    const mixed = [
      ':is(.sr-ios-app .sr-help-panel, .sr-help-panel) {',
      '  top: env(safe-area-inset-top);',
      '}',
    ].join('\n')
    expect(findUngatedSafeAreaRules(mixed, 'sr-help-panel').map(r => r.selector))
      .toEqual([':is(.sr-ios-app .sr-help-panel, .sr-help-panel)'])

    const gated = ':where(.sr-ios-app .sr-help-panel) { top: env(safe-area-inset-top); }'
    expect(findUngatedSafeAreaRules(gated, 'sr-help-panel')).toHaveLength(0)
  })

  it('keeps outer compounds on the functional selector subject', () => {
    const body = '{ top: env(safe-area-inset-top); }'
    const ungated = [
      `.sr-ios-app:is(.web > .sr-help-panel) ${body}`,
      `.sr-ios-app:where(.web .sr-help-panel) ${body}`,
      `.sr-ios-app:is(.sr-help-panel) ${body}`,
      `@media (width > 1px) { .sr-ios-app:is(.web > .sr-help-panel) ${body} }`,
      `@supports (top: 0) { .sr-ios-app:where(.web .sr-help-panel) ${body} }`,
      `.sr-ios-app:is(.web > .sr-help-panel, .sr-help-panel) ${body}`,
    ]
    for (const css of ungated) {
      expect(findUngatedSafeAreaRules(css, 'sr-help-panel'), css).toHaveLength(1)
    }

    const gated = [
      `:is(.sr-ios-app .sr-help-panel) ${body}`,
      `:where(.sr-ios-app > .sr-help-panel) ${body}`,
      `.sr-ios-app .sr-help-panel ${body}`,
      `.host:is(.sr-ios-app .sr-help-panel) ${body}`,
      `.sr-ios-app:is(.web > .leaf) .sr-help-panel ${body}`,
      `.sr-ios-app:where(.web .leaf) > .sr-help-panel ${body}`,
    ]
    for (const css of gated) {
      expect(findUngatedSafeAreaRules(css, 'sr-help-panel'), css).toHaveLength(0)
    }
  })

  it('composes multiple functional constraints without flattening their ancestry', () => {
    const body = '{ top: env(safe-area-inset-top); }'
    expect(findUngatedSafeAreaRules(
      `.sr-ios-app:is(.web > .sr-help-panel):where(.ready > .sr-help-panel) ${body}`,
      'sr-help-panel',
    )).toHaveLength(1)
    expect(findUngatedSafeAreaRules(
      `:is(.sr-ios-app > .sr-help-panel):where(.ready > .sr-help-panel) ${body}`,
      'sr-help-panel',
    )).toHaveLength(0)
  })

  it('does not let earlier functional constraints hide a later gated surface', () => {
    const css = [
      ':nth-child(1 of .x) .sr-ios-app .sr-help-panel {',
      '  top: env(safe-area-inset-top);',
      '}',
    ].join('\n')
    expect(findUngatedSafeAreaRules(css, 'sr-help-panel')).toHaveLength(0)
  })

  it('treats an @scope root as an ancestor gate, not an ordinary opaque at-rule', () => {
    const body = '.sr-help-panel { top: env(safe-area-inset-top); }'
    expect(findUngatedSafeAreaRules(`@scope (.sr-ios-app) { ${body} }`, 'sr-help-panel'))
      .toHaveLength(0)
    expect(findUngatedSafeAreaRules(`@scope (.other) { ${body} }`, 'sr-help-panel'))
      .toHaveLength(1)
    expect(findUngatedSafeAreaRules(
      `@scope (:is(.sr-ios-app, .other)) { ${body} }`,
      'sr-help-panel',
    )).toHaveLength(1)
  })

  it('walks native nested rules and carries the qualified-rule ancestry', () => {
    const ungated = [
      '.shell {',
      '  color: red;',
      '  .sr-help-panel { top: env(safe-area-inset-top); }',
      '}',
    ].join('\n')
    expect(findUngatedSafeAreaRules(ungated, 'sr-help-panel')).toHaveLength(1)

    const gated = [
      '.sr-ios-app {',
      '  .sr-help-panel { top: env(safe-area-inset-top); }',
      '}',
    ].join('\n')
    expect(findUngatedSafeAreaRules(gated, 'sr-help-panel')).toHaveLength(0)

    const parentSurface = [
      '.sr-help-panel {',
      '  &::before { top: env(safe-area-inset-top); }',
      '}',
    ].join('\n')
    expect(findUngatedSafeAreaRules(parentSurface, 'sr-help-panel').length).toBeGreaterThan(0)
  })

  it('recognizes functional and class-token spellings of the surface', () => {
    const fixtures = [
      ':is(.sr-help-panel) { top: env(safe-area-inset-top); }',
      ':where(.sr-help-panel) { top: env(safe-area-inset-top); }',
      '[class~="sr-help-panel"] { top: env(safe-area-inset-top); }',
      '[class="sr-help-panel"] { top: env(safe-area-inset-top); }',
      'li:nth-child(2 of .sr-help-panel) { top: env(safe-area-inset-top); }',
      '[class="sr-help-panel other"] { top: env(safe-area-inset-top); }',
      '[class="other sr-help-panel"] { top: env(safe-area-inset-top); }',
      String.raw`[class="other\20 sr-help-panel"] { top: env(safe-area-inset-top); }`,
      '[class="SR-HELP-PANEL other" i] { top: env(safe-area-inset-top); }',
      ':is([class="other sr-help-panel"]) { top: env(safe-area-inset-top); }',
    ]
    for (const css of fixtures) {
      expect(findUngatedSafeAreaRules(css, 'sr-help-panel'), css).toHaveLength(1)
    }
  })

  it('decodes escapes structurally without accepting class-name prefixes or embedded dots', () => {
    expect(findUngatedSafeAreaRules(
      String.raw`.\73 r-help-panel { top: \65 nv(\73 afe-area-inset-top); }`,
      'sr-help-panel',
    )).toHaveLength(1)

    expect(findUngatedSafeAreaRules(
      String.raw`.foo\.sr-ios-app .sr-help-panel { top: env(safe-area-inset-top); }`,
      'sr-help-panel',
    )).toHaveLength(1)
    expect(findUngatedSafeAreaRules(
      `.sr-ios-appé .sr-help-panel { top: env(safe-area-inset-top); }`,
      'sr-help-panel',
    )).toHaveLength(1)
  })

  it('takes the Cartesian product of nested parent alternatives', () => {
    const mixed = [
      '.sr-ios-app, .web {',
      '  & .sr-help-panel { top: env(safe-area-inset-top); }',
      '}',
    ].join('\n')
    expect(findUngatedSafeAreaRules(mixed, 'sr-help-panel')).toHaveLength(1)

    const gated = [
      '.sr-ios-app, .sr-ios-app.compact {',
      '  & .sr-help-panel { top: env(safe-area-inset-top); }',
      '}',
    ].join('\n')
    expect(findUngatedSafeAreaRules(gated, 'sr-help-panel')).toHaveLength(0)

    const prefixed = [
      '.sr-ios-app, .web {',
      '  .prefix & .sr-help-panel { top: env(safe-area-inset-top); }',
      '}',
    ].join('\n')
    expect(findUngatedSafeAreaRules(prefixed, 'sr-help-panel')).toHaveLength(1)
  })

  it('keeps nesting alternatives branch-specific inside :is() and :where()', () => {
    const body = '{ top: env(safe-area-inset-top); }'
    for (const pseudo of ['is', 'where']) {
      const mixed = `.sr-ios-app { :${pseudo}(&, .web) .sr-help-panel ${body} }`
      expect(findUngatedSafeAreaRules(mixed, 'sr-help-panel'), mixed).toHaveLength(1)

      const gated = `.sr-ios-app { :${pseudo}(&, &.compact) .sr-help-panel ${body} }`
      expect(findUngatedSafeAreaRules(gated, 'sr-help-panel'), gated).toHaveLength(0)
    }
  })

  it('fails closed when nesting appears inside unsupported functional selectors', () => {
    const body = '{ top: env(safe-area-inset-top); }'
    for (const nested of [
      `.sr-ios-app { :not(&) .sr-help-panel ${body} }`,
      `.sr-ios-app { :has(> &) .sr-help-panel ${body} }`,
    ]) {
      expect(() => findUngatedSafeAreaRules(nested, 'sr-help-panel'), nested)
        .toThrow(/Cannot safely inspect stylesheet: unsupported nesting selector inside/)
    }
  })

  it('expands nth-child selector lists and keeps nested branch alternatives independent', () => {
    const body = '{ top: env(safe-area-inset-top); }'
    expect(findUngatedSafeAreaRules(
      `li:nth-child(2 of .sr-help-panel) ${body}`,
      'sr-help-panel',
    )).toHaveLength(1)
    expect(findUngatedSafeAreaRules(
      `:nth-child(1 of .x) .sr-ios-app .sr-help-panel ${body}`,
      'sr-help-panel',
    )).toHaveLength(0)

    const nested = `.sr-ios-app { :nth-child(1 of &, .web) .sr-help-panel ${body} }`
    expect(findUngatedSafeAreaRules(nested, 'sr-help-panel')).toHaveLength(1)
  })

  it('takes scope and parent alternatives independently', () => {
    const mixedScope = [
      '@scope (:is(.sr-ios-app, .web)) {',
      '  .shell {',
      '    & .sr-help-panel { top: env(safe-area-inset-top); }',
      '  }',
      '}',
    ].join('\n')
    expect(findUngatedSafeAreaRules(mixedScope, 'sr-help-panel')).toHaveLength(1)

    const gatedScope = [
      '@scope (:is(.sr-ios-app, .sr-ios-app.compact)) {',
      '  .shell, .drawer {',
      '    & .sr-help-panel { top: env(safe-area-inset-top); }',
      '  }',
      '}',
    ].join('\n')
    expect(findUngatedSafeAreaRules(gatedScope, 'sr-help-panel')).toHaveLength(0)
  })

  it('does not carry a sibling parent gate through native nesting', () => {
    for (const combinator of ['+', '~', '||']) {
      const css = [
        `.sr-ios-app ${combinator} .shell {`,
        '  & .sr-help-panel { top: env(safe-area-inset-top); }',
        '}',
      ].join('\n')
      expect(findUngatedSafeAreaRules(css, 'sr-help-panel'), combinator).toHaveLength(1)
    }

    expect(findUngatedSafeAreaRules(
      '.sr-ios-app + .shell .sr-help-panel { top: env(safe-area-inset-top); }',
      'sr-help-panel',
    )).toHaveLength(1)
    expect(findUngatedSafeAreaRules(
      '.sr-ios-app .shell + .sr-help-panel { top: env(safe-area-inset-top); }',
      'sr-help-panel',
    )).toHaveLength(0)
    expect(findUngatedSafeAreaRules(
      '.sr-ios-app .shell + .drawer .sr-help-panel { top: env(safe-area-inset-top); }',
      'sr-help-panel',
    )).toHaveLength(0)

    for (const combinator of ['+', '~']) {
      const css = [
        '.sr-ios-app {',
        `  & ${combinator} .sr-help-panel { top: env(safe-area-inset-top); }`,
        '}',
      ].join('\n')
      expect(findUngatedSafeAreaRules(css, 'sr-help-panel'), `& ${combinator}`).toHaveLength(1)
    }

    for (const combinator of ['+', '~']) {
      const css = [
        '.sr-ios-app {',
        `  ${combinator} .sr-help-panel { top: env(safe-area-inset-top); }`,
        '}',
      ].join('\n')
      expect(findUngatedSafeAreaRules(css, 'sr-help-panel'), `implicit ${combinator}`)
        .toHaveLength(1)

      const conditional = [
        '.sr-ios-app {',
        '  @media (width > 1px) {',
        `    ${combinator} .sr-help-panel { top: env(safe-area-inset-top); }`,
        '  }',
        '}',
      ].join('\n')
      expect(findUngatedSafeAreaRules(conditional, 'sr-help-panel'), `conditional ${combinator}`)
        .toHaveLength(1)
    }
  })

  it('carries parent selectors through declarations in nested conditional rules', () => {
    const ungated = [
      '.sr-help-panel {',
      '  @media (width > 1px) {',
      '    top: env(safe-area-inset-top);',
      '  }',
      '}',
    ].join('\n')
    expect(findUngatedSafeAreaRules(ungated, 'sr-help-panel')).toHaveLength(1)

    const mixed = [
      '.sr-ios-app, .web {',
      '  @supports (top: 0) {',
      '    @media (width > 1px) { top: env(safe-area-inset-top); }',
      '  }',
      '}',
    ].join('\n')
    expect(findSafeAreaRules(mixed, 'sr-ios-app')).toHaveLength(1)
    expect(findUngatedSafeAreaRules(mixed, 'web')).toHaveLength(1)

    const gated = [
      '.sr-ios-app .sr-help-panel {',
      '  @container (width > 1px) { top: env(safe-area-inset-top); }',
      '}',
    ].join('\n')
    expect(findUngatedSafeAreaRules(gated, 'sr-help-panel')).toHaveLength(0)
  })

  it('requires the native-app gate to be an ancestor, not the surface itself', () => {
    const css = '.sr-ios-app.sr-help-panel { top: env(safe-area-inset-top); }'
    expect(findUngatedSafeAreaRules(css, 'sr-help-panel')).toHaveLength(1)
  })

  it('accepts only exact, case-sensitive native class tokens as gates', () => {
    const gated = [
      '[class~="sr-ios-app"] .sr-help-panel { top: env(safe-area-inset-top); }',
      String.raw`.\73 r-ios-app .sr-help-panel { top: env(safe-area-inset-top); }`,
    ]
    for (const css of gated) {
      expect(findUngatedSafeAreaRules(css, 'sr-help-panel'), css).toHaveLength(0)
    }

    const fakeGates = [
      '[class*="sr-ios-app"] .sr-help-panel { top: env(safe-area-inset-top); }',
      '[class~="SR-IOS-APP" i] .sr-help-panel { top: env(safe-area-inset-top); }',
      '[data-class="sr-ios-app"] .sr-help-panel { top: env(safe-area-inset-top); }',
    ]
    for (const css of fakeGates) {
      expect(findUngatedSafeAreaRules(css, 'sr-help-panel'), css).toHaveLength(1)
    }

    expect(findUngatedSafeAreaRules(
      '[class~="SR-HELP-PANEL" i] { top: env(safe-area-inset-top); }',
      'sr-help-panel',
    )).toHaveLength(1)
  })

  it('treats a scoped surface root as the surface for :scope declarations', () => {
    const ungated = [
      '@scope (.sr-help-panel) {',
      '  :scope { top: env(safe-area-inset-top); }',
      '}',
    ].join('\n')
    expect(findUngatedSafeAreaRules(ungated, 'sr-help-panel')).toHaveLength(1)

    const gated = [
      '@scope (.sr-ios-app .sr-help-panel) {',
      '  :scope { top: env(safe-area-inset-top); }',
      '}',
    ].join('\n')
    expect(findUngatedSafeAreaRules(gated, 'sr-help-panel')).toHaveLength(0)

    const nested = [
      '@scope (.sr-help-panel) {',
      '  :scope {',
      '    & .child { top: env(safe-area-inset-top); }',
      '  }',
      '}',
    ].join('\n')
    expect(findUngatedSafeAreaRules(nested, 'sr-help-panel')).toHaveLength(1)

    const bare = '@scope { :scope .sr-help-panel { top: env(safe-area-inset-top); } }'
    expect(findUngatedSafeAreaRules(bare, 'sr-help-panel')).toHaveLength(1)

    for (const combinator of ['+', '~']) {
      const siblingScope = [
        '@scope (.sr-ios-app) {',
        `  @scope (:scope ${combinator} .shell) {`,
        '    .sr-help-panel { top: env(safe-area-inset-top); }',
        '  }',
        '}',
      ].join('\n')
      expect(findUngatedSafeAreaRules(siblingScope, 'sr-help-panel'), `scope ${combinator}`)
        .toHaveLength(1)
    }
  })

  it('ignores comments, strings, and fallback arguments that only mention safe area', () => {
    const css = [
      '.sr-help-panel {',
      '  /* top: env(safe-area-inset-top); */',
      '  content: "env(safe-area-inset-top)";',
      '  top: env(title, safe-area-inset-top);',
      '}',
    ].join('\n')
    expect(findSafeAreaRules(css, 'sr-help-panel')).toHaveLength(0)
  })

  it('keeps duplicate hazardous selector members visible', () => {
    const css = [
      '.sr-help-panel, .sr-help-panel { top: env(safe-area-inset-top); }',
      '.sr-help-panel { top: env(safe-area-inset-top); }',
    ].join('\n')
    expect(findUngatedSafeAreaRules(css, 'sr-help-panel')).toHaveLength(3)
  })

  it('fails closed on malformed or unsupported parser recovery', () => {
    expect(() => findUngatedSafeAreaRules(
      '.sr-help-panel { top: env(safe-area-inset-top); broken }',
      'sr-help-panel',
    )).toThrow(/Cannot safely inspect stylesheet/)

    expect(() => findUngatedSafeAreaRules(
      '.sr-help-panel:unknown(.sr-ios-app) { top: env(safe-area-inset-top); }',
      'sr-help-panel',
    )).toThrow(/Cannot safely inspect stylesheet/)

    expect(() => findUngatedSafeAreaRules(
      '.sr-ios-app .sr-help-panel { top: env(safe-area-inset-top);',
      'sr-help-panel',
    )).toThrow(/Cannot safely inspect stylesheet/)

    expect(() => findUngatedSafeAreaRules(
      '.sr-ios-app .sr-help-panel { top: env(safe-area-inset-top); } /*',
      'sr-help-panel',
    )).toThrow(/Cannot safely inspect stylesheet/)
  })

  it('fails closed before selector alternatives can expand beyond the test-only budget', () => {
    const underBudget = Array.from(
      { length: 11 },
      (_, index) => `:is(.under-${index}-a, .under-${index}-b)`,
    ).join('')
    expect(findUngatedSafeAreaRules(
      `${underBudget}.sr-help-panel { top: env(safe-area-inset-top); }`,
      'sr-help-panel',
    )).toHaveLength(1)

    const overBudget = Array.from(
      { length: 13 },
      (_, index) => `:is(.over-${index}-a, .over-${index}-b)`,
    ).join('')
    expect(() => findUngatedSafeAreaRules(
      `${overBudget}.sr-help-panel { top: env(safe-area-inset-top); }`,
      'sr-help-panel',
    )).toThrow(
      'Cannot safely inspect stylesheet: selector path expansion exceeds 4096 alternatives',
    )

    const alternatives = (prefix: string, count: number) => Array.from(
      { length: count },
      (_, index) => `.${prefix}-${index}`,
    ).join(', ')
    const nestedParents = [
      `${alternatives('parent', 65)} {`,
      `  :is(${alternatives('child', 64)}) .sr-help-panel {`,
      '    top: env(safe-area-inset-top);',
      '  }',
      '}',
    ].join('\n')
    expect(() => findUngatedSafeAreaRules(nestedParents, 'sr-help-panel'))
      .toThrow(/selector path expansion exceeds 4096 alternatives/)

    const nestedScopes = [
      `@scope (:is(${alternatives('outer-scope', 65)})) {`,
      `  @scope (:is(${alternatives('inner-scope', 64)})) {`,
      '    .sr-help-panel { top: env(safe-area-inset-top); }',
      '  }',
      '}',
    ].join('\n')
    expect(() => findUngatedSafeAreaRules(nestedScopes, 'sr-help-panel'))
      .toThrow(/selector path expansion exceeds 4096 alternatives/)

    const scopedRule = [
      `@scope (:is(${alternatives('scope', 65)})) {`,
      `  :is(${alternatives('rule', 64)}) .sr-help-panel {`,
      '    top: env(safe-area-inset-top);',
      '  }',
      '}',
    ].join('\n')
    expect(() => findUngatedSafeAreaRules(scopedRule, 'sr-help-panel'))
      .toThrow(/selector path expansion exceeds 4096 alternatives/)
  })

})
