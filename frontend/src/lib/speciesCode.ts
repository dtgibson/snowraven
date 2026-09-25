// The eBird species-code shape, ONE definition for every place the app accepts
// a code from outside its own taxonomy lookup (ios-lifer-widgets, Stage 8):
//
//   * `SpeciesLinks` gates every favicon and eBird species-page href on it, so a
//     code that fails it renders nothing (.claude/rules/bird-names.md);
//   * the widget deep link (`lib/links/deepLink.ts`) accepts a bird only when its
//     code matches it, so a code the app would link to is never one the link
//     parser drops, and the reverse;
//   * the widget extension's Swift builder (`DeepLink.swift`) spells the same
//     pattern, and `widgetPaths.parity.test.ts` compares the two as text.
//
// Lowercase letters, digits and a hyphen, 2 to 16 characters: every code in the
// eBird taxonomy fits (the longest is 10), and the class cannot express a URL
// separator, a quote or a path. Dependency-free, so it is safe on the entry
// chunk (SpeciesLinks is statically reachable) and inside the link parser.

export const SPECIES_CODE_RE = /^[a-z0-9-]{2,16}$/
