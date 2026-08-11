## help-link-scheme-gate

### What this does

Gates the in-app Help renderer's markdown links on an absolute http(s) scheme, and
moves the anchor onto the shared `OutboundLink`.

`HelpDocs.tsx` interpolated a parsed markdown link target straight into `href`, so
the renderer would emit a live, styled `javascript:` or `data:` anchor if it were
ever pointed at content other than the bundled `docs/HELP.md`. This is defensive
hardening, not a live fix: the `?raw` build-time import means the only input today
is a developer-controlled static file, and all 7 of its links are `https://`. The
point is that the renderer's safety stops *depending* on that decision holding
forever.

The gate is the repo's already-shipped formulation, `/^https?:\/\//i`
(`CommentText.tsx:23`), deliberately **not** the looser `/^https?:/i` the original
idea proposed, which admits `https:evil`. On a miss the link **text** renders as
plain escaped text and the anchor is dropped, matching the established answer
everywhere else in the app (`ChecklistLink`, `HotspotLink`, `CommentText`'s
non-link span): never ship a styled link you cannot vouch for.

The anchor also moves onto `OutboundLink`, fulfilling the v0.5.32 decision that it
is "the standard wrapper for every NON-checklist external link." This anchor
predated the wrapper and hand-rolled `target="_blank"` + `rel="noreferrer"` + an
`.sr-only` cue in place.

**No version bump / changelog entry in this commit** — this is one build in a
bundled Spool release, and the bump happens once for the whole bundle.

### Files

- `frontend/src/lib/helpLinks.ts` — **new.** The gate (`isSafeHelpLinkTarget`), the
  token parse (`parseHelpLinkToken`), and a fresh-per-call `/g` scanner factory
  (`helpInlineTokenRe`). It needs a `lib/` home because `renderInline` is
  module-private and a non-component export from a `.tsx` trips
  `react-refresh/only-export-components` — the same constraint that put
  MediaEmbed's constants in `lib/mediaEmbed.ts`.
- `frontend/src/lib/helpLinks.test.ts` — **new.** The guard, asserted in both
  directions.
- `frontend/src/components/HelpDocsHostileContent.test.tsx` — **new.** Drives the
  renderer with hostile content via a mocked `?raw` import. This is the test that
  rejects the gate being deleted from the renderer; see note 4.
- `frontend/src/components/HelpDocs.tsx` — gate wired in; anchor → `OutboundLink`.
- `frontend/src/components/HelpDocs.test.tsx` — F078 re-pointed; two tests added.

### How to test

See `how-to-see.md` for the click-through. Automated:

```
cd frontend
npx vitest run src/lib/helpLinks.test.ts \
  src/components/HelpDocs.test.tsx \
  src/components/HelpDocsHostileContent.test.tsx
npm run lint
npm run build
```

### Notes for reviewer

**1. The announced name is unchanged, exactly as the brief predicted.** All 7 links
announce `ebird.org (opens in a new tab)` (and so on) on **both** revisions,
byte-identical, along with `href`, `target`, `rel`, and the visible copy.

Recording a wrong turn, because it is the more useful half of this note. An
earlier revision of this PR claimed in bold that the name gained a space and that
the brief was wrong, labelled "measured, not reasoned about." That measurement was
`computeAccessibleName` from `dom-accessibility-api` — testing-library's jsdom
model, **a proxy, not a render**. It omits the inter-node space that real engines
insert per the accname algorithm, so it reports a spurious one-space delta between
an `.sr-only` cue node and an `aria-label`. jsdom has no accessibility tree; there
was never anything there to measure.

Re-measured against real accessibility trees, which is what CLAUDE.md's v0.5.83
rule prescribes for exactly this question (and Playwright is already a dependency
in `website/tools/`):

| engine | before | after |
|---|---|---|
| Chromium (`ariaSnapshot` + CDP `Accessibility.getFullAXTree`, agreeing) | `ebird.org (opens in a new tab)` | identical |
| WebKit — the engine the macOS and iOS apps actually ship on | `ebird.org (opens in a new tab)` | identical |

The `.sr-only` declarations in that harness were parsed out of the real
`globals.css` rather than retyped, per the same rule. `HelpDocs.test.tsx` already
said "byte-identical"; the build had been contradicting itself.

So the change is announced-name-neutral. It is still worth making: it puts the Help
links on the same shared wrapper as every other external link in the app, which is
the v0.5.32 decision.

No published prose needed updating: `ACCESSIBILITY.md`'s "every external link
announces that it opens in a new tab" claim stays true (and is now delivered
through the shared wrapper), and nothing in `ACCESSIBILITY.md`, `README.md`,
`docs/HELP.md`, or `website/index.html` describes the `.sr-only` mechanism —
verified by grep, since a statement quoting a name the component doesn't emit is
exactly the defect class the repo has been bitten by twice.

**2. The F078 test was re-pointed at the guarantee, not loosened.** It asserted the
cue out of an `.sr-only` child node — one of the two ways `OutboundLink` can carry
it, and not the one plain-string children take. That is an implementation detail,
and it went red on a change that left the announced name correct. It now asserts
the accessible name via `getByRole('link', { name: ... })`, anchored at the end so
it pins both the exact cue wording and the fact that the visible text *leads* the
name (WCAG 2.5.3 Label in Name) — a guarantee the old assertion never made.

**3. An `![alt](src)` image reaches `href` by this same path — confirmed, not
assumed.** The scanner's link alternative starts at the `[`, so the leading `!`
falls through into the preceding plain-text slice and the rest of the image is
parsed as an ordinary link. That is why one gate closes every door in this
renderer. Asserted directly in `helpLinks.test.ts` (both the tokenization and the
rejection of a `javascript:`/`data:` image src) rather than left as a claim.
`docs/HELP.md` contains no images today.

**4. Mutation-checked in both directions.** This is a security guard, so each form
the defect could actually return in was applied and the suite re-run:

Every form is now rejected by BOTH the predicate's unit tests and, independently,
by the renderer driven with hostile content:

| mutation | expected | `helpLinks.test.ts` | `HelpDocsHostileContent.test.tsx` |
|---|---|---|---|
| A. guard removed (`return true`) | RED | RED (18 failing) | RED (5) |
| B. loosened to `/^https?:/i` | RED | RED — `https:evil`, `http:evil` | RED (3) |
| C. `^` anchor dropped | RED | RED — `javascript:void("https://…")` | RED (3) |
| D. `i` flag dropped | RED | RED — uppercase-scheme **accept** case | RED (1) |
| E. parse returns an empty target (seam dead) | RED | RED (2) | RED (2) |
| F. renderer bypasses the gate | RED | (out of reach) | **RED (5)** |
| G. renderer drops every anchor | RED | (out of reach) | RED (2) |

Counts are per file. Mutation E also reddens 3 tests in `HelpDocs.test.tsx`, which
has no column here; an earlier revision of this table reported that combined 5 in
the `helpLinks.test.ts` column.

**F is the one that matters, and an earlier revision of this PR got it wrong.** It
argued that no test could reject F "without adding a content prop, which would be
actively wrong," and recorded F as a documented GREEN. That was false. A test needs
no production change at all: `vi.mock('../../../docs/HELP.md?raw', …)` drives the
real renderer with hostile content, and the component still takes no content prop.
As things previously stood, someone could delete the gate from `HelpDocs.tsx` and
the entire suite stayed green — G proved the wiring *existed*, nothing proved it
could not be *removed*, and "the renderer stops calling the gate" is the single
most obvious form the defect could return in. That gap is now closed by
`HelpDocsHostileContent.test.tsx` (adopted from QA's proposed fixture).

Two further notes on the matrix:

- **C and D were still slipping past the renderer-level fixture as adopted**, found
  by running them rather than trusting the list. No hostile row embedded an
  `http(s)` substring, so an unanchored predicate rejected everything anyway and
  reported a clean bill on a broken guard; and no row was a legitimate
  uppercase-scheme link, so dropping `/i` was invisible. Rows **P**
  (`javascript:void("https://ok.example")`) and **Q** (`HTTPS://Ok.Example/x`,
  which must keep linking) close both. Q's text deliberately near-collides with
  another row's, which is what forced the "must not be a link" assertion onto exact
  element matching instead of a substring scan over a joined string — that scan was
  reporting a leak when nothing had leaked.
- **E remains the payoff for testing both directions.** The guard is untouched and
  every hostile case still fails correctly, but nothing real reaches it. A
  rejects-only suite stays green on exactly this.

**5. The inline scanner is now linear by construction (audit Medium, closed).**
The scanner runs *before* the gate, and unbounded it was O(n²) — so under the very
threat model note 1 invokes ("stops depending on that staying true forever"), a
hostile Help document would have hung the main thread before any target reached
the gate. The gate alone did not make that claim good. Pre-existing (both regex
literals byte-identical to pre-change) and unreachable from shipped content, but
in scope precisely because the comment claimed otherwise.

All four quantifiers are length-bounded, following `lib/commentBlocks.ts`, which
CLAUDE.md records as this repo having already shipped this exact defect class once
(4.1 s on a 400 KB hostile comment). Measured, minimum of three complete runs, on
a hostile document of unterminated openers:

| input | unbounded | growth | bounded | growth |
|---|---|---|---|---|
| 25 KB | 30.8 ms | — | 1.18 ms | — |
| 50 KB | 122.4 ms | 3.98x | 2.38 ms | 2.01x |
| 100 KB | 489.2 ms | 4.00x | 4.78 ms | 2.01x |
| 200 KB | 1962.5 ms | 4.01x | 9.56 ms | 2.00x |

4.00x per doubling → 2.00x per doubling: quadratic → linear, 205x faster at 200 KB.

**The bound is 500, and it is not a round number pulled from nowhere.** It is 5.4x
the longest token of *any* kind in the shipped `HELP.md` (a 93-char bold run) and
11.9x the longest link target (42 chars). Those maxima are measured across the
exact strings `parseBlocks` hands to `renderInline`, **not** the raw file:
fenced code blocks never reach the scanner, and measuring the raw file reports a
spurious 22,179-char "code span" from backticks pairing across two fences — which
would have made the bound look far too tight. 500 also sits well under the longest
block the renderer scans (2,945 chars), so no ordinary paragraph can reach it.

Behavior is unchanged on real content, verified rather than asserted: bounded and
unbounded tokenize the real `HELP.md` identically — 295 blocks, 256 tokens, zero
differences — and all 7 links still render.

Four tests, mutation-checked by reverting the pattern to its unbounded form:

- **structural** — no `*`/`+` directly after a character class or group close;
  all four quantifiers bounded and single-sourced off the constant. Includes a
  guard-the-guard assertion that the pre-change pattern *does* trip it. **RED**
  on the unbounded form.
- **timing** — 200 KB hostile document, min of three complete runs (the QA-41
  pattern), ceiling 300 ms: ~30x margin over bounded, ~6x below unbounded, a gap
  no shared runner closes in either direction. **RED** on the unbounded form
  (6537 ms).
- **tokenization parity** vs the unbounded pattern, which also fails if `HELP.md`
  ever grows a token past the bound, so growth surfaces as a test failure rather
  than a link silently degrading to literal text. Correctly stays GREEN under the
  mutation: it guards behavior, not the bound's presence.
- **headroom** — at least 2x under the bound for every token kind.

Also in this area: the scanner is a factory rather than a module-level constant,
since a module-level `/g` regex carries shared mutable `lastIndex` (0.5.27
post-mortem) and the renderer scans in an `exec` loop. The pattern *source* is a
module-level string, which has no such hazard.

**6. Two audit Informationals, deliberately not changed.** The gate authorizes the
*scheme*, not the host — userinfo, backslash authority, and punycode confusion are
out of its scope, which is correct for a scheme gate and consistent with
`CommentText`. And `OutboundLink` spreads `{...rest}` after `target`/`rel`, so a
caller could override them; pre-existing, no impact here. Both are noted for the
Chronicler rather than fixed under this brief.

**7. Deliberately out of scope.** `CommentText.tsx`'s non-use of `OutboundLink` is
intentional and stays as-is; the brief scoped it out. The two copies of the
predicate are therefore separate on purpose, noted at the definition site so a
future consolidation is a deliberate step rather than an accident.

**8. Unrelated pre-existing flake.** The full 154-file suite showed one failure,
`Calendar.test.tsx > opening a second day popup replaces the first (QA-38)`,
"Test timed out in 5000ms" with a reported duration of 891s — scheduling
starvation under a 908s full-suite run. It passes 45/45 in isolation, and
`helpLinks` is imported only by `HelpDocs.tsx` (lazily loaded by App), so it is
outside this change's import graph entirely; Calendar's only textual match was a
code comment. Not touched, not in scope.
