# Change Brief — flaky-test-and-mini-mentions

**Lane:** Improve · **Approved:** 2026-06-11 (Stage 1 gate; copy previewed and approved verbatim)

## Goal

Two independent items, one patch release:
A. Eliminate the flaky `BirdingStats.test.tsx` full-suite failures (pre-existing, ~11%).
B. Add three informational mentions of SnowRaven Mini (the author's separate
   Chrome/Firefox extension, https://github.com/dtgibson/snowraven-mini) — aware, not
   steered; no promotion.

## A. Flake fix (test infrastructure only — no production code)

**Root cause (reproduced and pinned):** `recharts` bundles `@reduxjs/toolkit` 2.12.0
(`npm ls`: frontend → recharts@3.8.1 → @reduxjs/toolkit). Its autoBatch enhancer races
a captured `requestAnimationFrame` against a 100 ms fallback `setTimeout`
(`redux-toolkit.modern.mjs:481` calls bare `cancelAnimationFrame(rafId)` when the timer
wins). `BirdingStats.test.tsx` stubs rAF/cAF per-test (`vi.stubGlobal`, lines 107-116)
and restores in `afterEach` (`vi.unstubAllGlobals`, line 123); the stubbed rAF never
fires, so the 100 ms timer always wins — AFTER the globals were restored, in an
environment with no native `cancelAnimationFrame` → unhandled
`ReferenceError: cancelAnimationFrame is not defined` (observed 4× in run 2 of 5 local
full-suite runs; attributed by vitest to "BirdingStats.test.tsx ... while it was
running"; isolation 3/3 clean). Vitest's unhandled-error handling intermittently fails
whichever test is running — the ~11% flake. The double-rAF assertions themselves are
deterministic and correct.

**Fix:**
1. New `frontend/src/test-setup.ts`: install BASELINE animation-frame shims —
   if `globalThis.requestAnimationFrame` is undefined, define it as
   `setTimeout(() => cb(performance.now()), 0)` returning the timer id, and
   `cancelAnimationFrame` as `clearTimeout`. Idempotent, no-ops where real
   implementations exist (per-file jsdom envs keep theirs if present). Keep it tiny
   and commented with the recharts/toolkit root cause.
2. `frontend/vite.config.ts`: add the vitest `test.setupFiles` entry pointing at it
   (use the project's existing config idiom; vitest reads the `test` key from
   vite.config.ts).
3. Do NOT change `BirdingStats.test.tsx` stubs or assertions; do NOT touch recharts
   or production code.

**Acceptance:** 10 consecutive full `npx vitest run` passes with ZERO unhandled
errors (grep the output), plus 3 isolated `BirdingStats.test.tsx` runs green.

## B. SnowRaven Mini mentions — approved copy, verbatim

Facts: name "SnowRaven Mini"; repo link everywhere
`https://github.com/dtgibson/snowraven-mini`; NOT on extension stores (do not link
stores or the landing site); informational register per CLAUDE.md Voice.

### B1. Weather tab (App.tsx)

Insert between the weather card's closing `</div>` (App.tsx:895) and the
`panel-weather` tabpanel's closing `</div>` (App.tsx:896): a centered `<p>`,
`width: '100%', maxWidth: 540, margin: '14px 0 0', textAlign: 'center',
fontSize: '0.75rem', color: 'var(--sr-text-footer)'`. Text (the name is the anchor):

> Also for your browser: [SnowRaven Mini], a Chrome/Firefox extension with this same
> weather and tide lookup.

Anchor: `href="https://github.com/dtgibson/snowraven-mini" target="_blank"
rel="noreferrer"`, `color: 'inherit'`, underlined (always), with an
`aria-label="SnowRaven Mini on GitHub (opens in new tab)"`. NO icon, NO favicon, NO
fetch (privacy: a plain href makes no request until clicked — PRIVACY_POLICY.md
unchanged). Tokens only, no hex.

### B2. README.md

New paragraph at the end of "What it does", after the line
"Full per-feature documentation lives in **[docs/HELP.md](docs/HELP.md)**." (L21),
before `## Privacy`:

> A companion project, [SnowRaven Mini](https://github.com/dtgibson/snowraven-mini),
> is a small Chrome and Firefox extension that runs the same weather and tide lookup
> right on the eBird checklist page. It's separate from SnowRaven and not required by
> it.

### B3. docs/HELP.md

New `### SnowRaven Mini (browser extension)` H3 inside `## Weather`, after the
`### Tides` subsection content (after L92), before the `---` at L94:

> SnowRaven Mini is a separate companion project: a small Chrome and Firefox extension
> that runs the same weather and tide lookup directly on an eBird checklist's Edit
> Comments page and copies the block for pasting, in the same format SnowRaven
> produces. It is independent of the app — nothing in SnowRaven requires or uses it —
> and it needs its own copies of the free eBird and OpenWeather keys. It is not yet on
> the extension stores; source, releases, and documentation live at
> [github.com/dtgibson/snowraven-mini](https://github.com/dtgibson/snowraven-mini).

NO HelpDocs.tsx TOC entry (H3-under-Weather, Tides precedent — deliberately low-key).
Renderer constraints: bold/`code`/links only — the copy above complies (the em dash
in prose is fine; no italics, no tables).

## Decisions on the record

- Website stays SILENT about Mini this change (purpose reading of CLAUDE.md's sync
  rule; the user specified exactly three places; a companion-project mention is not an
  app feature). The website still needs its version pill/footer bumped pre-push per
  the 0.5.28 precedent — that plus CHANGELOG/version chores ride as usual.
- Out of scope: snowraven-mini's own formatter lacks the v0.5.28 moon-phase emoji
  (drift in the OTHER repo; flagged to the user, not addressed here).

## Release chores (CLAUDE.md)

Patch bump 0.5.28 → 0.5.29 in BOTH `frontend/package.json` and
`src-tauri/tauri.conf.json`; `CHANGELOG.md` entry (flake fix + Mini mentions);
README/HELP changes are themselves part B; website version pill/footer → v0.5.29 at
push time (established pre-push practice).

## Acceptance (whole change)

- Full vitest + pytest suites green; the 10-run zero-unhandled-error criterion above.
- `git diff` on `frontend/src/components/BirdingStats.test.tsx`,
  `frontend/src/lib/commentBlocks.ts`, and all formatters: EMPTY.
- The three mentions land byte-equal to the approved copy above.
