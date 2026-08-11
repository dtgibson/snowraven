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
