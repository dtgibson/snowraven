// Selector specificity for the stylesheet guards. Test-only: nothing in the app
// imports it, so it is never bundled.
//
// Moved out of lib/mapFabCascade.test.ts (life-list-filter-toggle-state) so a
// second guard could reuse it instead of writing a sixth local copy, and
// corrected on the way: a CLASS selector used to fall through to the final
// branch and count as a TYPE selector, so `.sr-pill` scored (0,0,1) instead of
// (0,1,0). Every selector the map FAB scan compared carried the same number of
// classes on both sides, so none of its verdicts moved (all of its rows stayed
// green with the correction in place, built bundle included), but a guard that
// compares a class-heavy selector against an attribute-heavy one would have
// read the wrong winner. lib/controlRegisters.test.ts pins the corrected
// scores against literal tuples.

/** Split a selector list on top-level commas (not inside () or []). */
export function splitList(sel: string): string[] {
  const parts: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of sel) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (ch === ',' && depth === 0) { parts.push(cur); cur = '' } else cur += ch
  }
  if (cur.trim()) parts.push(cur)
  return parts.map(p => p.trim()).filter(Boolean)
}

/** Simple selectors inside one compound, in order. */
export function simpleParts(compound: string): string[] {
  const parts: string[] = []
  let i = 0
  while (i < compound.length) {
    const ch = compound[i]
    if (ch === '[') {
      const end = compound.indexOf(']', i)
      parts.push(compound.slice(i, end + 1)); i = end + 1; continue
    }
    if (ch === '#' || ch === '.' || ch === ':') {
      let j = i + 1
      if (ch === ':' && compound[j] === ':') j++
      while (j < compound.length && /[-\w\\]/.test(compound[j])) j++
      if (compound[j] === '(') {           // functional pseudo: take the whole ()
        let d = 1; j++
        while (j < compound.length && d > 0) { if (compound[j] === '(') d++; else if (compound[j] === ')') d--; j++ }
      }
      parts.push(compound.slice(i, j)); i = j; continue
    }
    let j = i
    while (j < compound.length && /[-\w*|\\]/.test(compound[j])) j++
    if (j === i) { i++; continue }
    parts.push(compound.slice(i, j)); i = j
  }
  return parts
}

/**
 * The compounds of one complex selector, split on combinators at depth 0 only.
 *
 * Depth-aware for the same reason rightmostCompound (lib/mapFabCascade.test.ts)
 * is. This used to be a
 * single split on a lookahead, `(?![^([]*[)\]])`, which is blind to a `[` inside
 * a functional pseudo: `:where(.a .b[x=y] > .c)` was torn at the inner space into
 * `:where(.a` and `.b[x=y]>.c)`, so a ZERO-specificity selector scored (0,2,0)
 * and read as a competitor that outranks the FAB rules. Caught when the
 * county-date-filter-mobile date-range register put its desktop set-state rule
 * under `:where()`; no selector without that shape scores differently.
 */
export function compoundsOf(sel: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of sel) {
    if (ch === '(' || ch === '[') depth++
    else if (ch === ')' || ch === ']') depth--
    if (depth === 0 && (/\s/.test(ch) || ch === '>' || ch === '+' || ch === '~')) {
      if (cur) out.push(cur)
      cur = ''
      continue
    }
    cur += ch
  }
  if (cur) out.push(cur)
  return out
}

/** (a,b,c). Functional pseudos take the MAX of their arguments; :where() takes 0. */
export function specificity(sel: string): [number, number, number] {
  let a = 0, b = 0, c = 0
  const compounds = compoundsOf(sel)
  for (const compound of compounds) {
    for (const p of simpleParts(compound)) {
      if (p.startsWith('#')) a++
      else if (p.startsWith('.')) b++
      else if (p.startsWith('[')) b++
      else if (p.startsWith('::')) c++
      else if (p.startsWith(':')) {
        const name = p.slice(1).replace(/\(.*$/s, '').toLowerCase()
        const args = p.match(/\((.*)\)$/s)?.[1]
        if (name === 'where') continue
        if (args && ['not', 'is', 'has', 'matches', 'any'].includes(name)) {
          let best: [number, number, number] = [0, 0, 0]
          for (const inner of splitList(args)) {
            const s = specificity(inner)
            if (s[0] > best[0] || (s[0] === best[0] && (s[1] > best[1] || (s[1] === best[1] && s[2] > best[2])))) best = s
          }
          a += best[0]; b += best[1]; c += best[2]
          continue
        }
        b++
      }
      else if (p === '*') continue
      else c++
    }
  }
  return [a, b, c]
}
