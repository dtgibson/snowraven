# Decisions: sortable-list-links-own-dispatch (Improve lane, Stage 2, The Engineer)

## What changed

- `frontend/src/lib/openExternal.ts`. New `openNewTabLink(event, href)`, the click handler every app-drawn new-tab link carries. It resolves `href` with `new URL(href, document.baseURI)`, leaves a URL that does not parse or is not http(s) alone, and hands the resolved string to the existing `openExternalLink` (v1.0.28), whose gate and web/Pi no-op are unchanged. The header now states the rule. `openExternalLink`'s parameter type is named (`OpenerClick`); its body is unchanged.
- The shared owners call it with the URL they already build from a validated id:
  - `OutboundLink.tsx` (and through it `HotspotLink`): `onClick={event => { onClick?.(event); openNewTabLink(event, href) }}`, after `{...rest}`. A caller's `onClick` runs first.
  - `ChecklistLink.tsx`: the href is hoisted to one `const href` after the `SUBMISSION_ID_RE` gate and used for both.
  - `SpeciesLinks.tsx`: the one `SpeciesLinkMark`, so both marks.
  - `CommentText.tsx`: the map callback binds `const href = seg.href` so the closure keeps its narrowing; the `/^https?:\/\//i` gate is unchanged.
- The seven hand-written `target="_blank"` anchors gain the same handler in place, each with its URL built once and used for both `href` and the click: `LifeListTable.tsx` (four per row: `photoHref`, `audioHref`, `videoHref`, `allHref`), `SpeciesDetail.tsx` (the existing `link`), and the two Weather tab links that were inline in `App.tsx`. They stay on `Link`, not `OutboundLink`, as the brief requires: `tabOrderCoverage.test.ts` counts `Link` call sites and its link floor must hold.
- `components/WeatherTabLinks.tsx` (new, added at the QA fix): the Edit checklist comment link (`EditCommentLink`, which builds its href from `checklistId` once) and the SnowRaven Mini link (`SnowRavenMiniLink`, with the module-private `SNOWRAVEN_MINI_URL`), lifted out of `App.tsx` unchanged so a test can click them without rendering the whole app. `App.tsx` renders the two components in place of the inline anchors and drops its `ExternalLink` import. Rendered markup is byte-identical: a throwaway test rendered HEAD's inline JSX, copied verbatim, beside the components and compared `innerHTML` (equal for both; deleted after use). The `Link` call sites move file with it, so `tabOrderCoverage.test.ts`'s link population is unchanged, and the new file sits under `ui.md`'s existing `components/**` gate.
- `WeatherBacklog.tsx`: its `openChecklist` / `openEdit` handlers and the `checklistUrl` they used are removed (below), and so is `ChecklistLink`'s `onClick` prop, which they were its only callers of.
- `.claude/rules/ui.md` `paths` gains `frontend/src/lib/openExternal.ts` and `frontend/src/lib/newTabLinkDispatch.test.ts` (CLAUDE.md's rule: the rule the Chronicler rewrites will name both).
- `components/ui/Link.tsx` is untouched (v1.0.24).

## The URL sent is the closure's, resolved the way the anchor resolves it

**Closure, not `event.currentTarget.href`.** Each handler is given the expression the element renders as its `href`, captured when the row rendered. Reading the anchor at click time would be right for a bubble-phase ancestor (the anchor's own handler runs first in React's dispatch) but wrong for a capture-phase ancestor that redraws the row with `flushSync` before the anchor's handler runs. The closure is the render the user clicked in both cases.

**Resolved, not raw.** The opener plugin's listener sent `new URL(anchor.href)`, which the IPC layer serializes to its href, so before this change native code received the anchor's RESOLVED href. `new URL(href, document.baseURI)` is the algorithm the anchor's `href` getter runs (the document's base URL, UTF-8), so the string sent is the same one. It differs from the raw text in exactly the cases the brief named: a user URL in a comment with a mixed-case host, a non-ASCII host, path or query, a backslash, braces (`CommentText.test.tsx` pins three such shapes with literal expected hrefs), and a query value `encodeURIComponent` leaves alone but the URL parser escapes, the apostrophe (`OutboundLink.test.tsx`). For every URL the app builds itself from a validated id, the two are already equal.

**Left alone: a URL that does not parse, or a scheme other than http(s).** No cancel and no dispatch, so whatever happened to such a link before still happens. Today no call site can produce either (CommentText gates on `/^https?:\/\//i`; every other site writes `https://`), so this is parity, not behavior: the listener also threw on an unparseable href and opened nothing. The scheme set is http(s) only, a subset of the listener's (it also opened mailto and tel). A mailto or tel new-tab link would fall through to the listener exactly as before; none exists.

**One gate.** `openNewTabLink` has no `isTauri()` check of its own. An early draft did, and it duplicated `openExternalLink`'s, which made the web row unable to see a deletion of either (two mechanisms over one behavior). With one gate, mutation M4 below turns the web row red.

## Composition: the caller first, and nothing opens twice

- `OutboundLink` puts its `onClick` after `{...rest}`, so a caller cannot replace it, and calls the caller's first. `openExternalLink` reads the NATIVE event's `defaultPrevented`, so a caller that cancels the click on either the React event or the native event is seen, and the shared handler leaves it alone (tested). The native event is also what the plugin's listener reads, so a click this handler sends is a click the listener skips.
- Attribute order is unchanged everywhere (`href`, `target`, `rel`, rest, `aria-label`), and a React click handler adds no attribute, so the rendered markup is byte-identical (verified below).
- No ancestor in shipped code reads a click's cancelled state (`defaultPrevented` / `isDefaultPrevented` appear nowhere else in `src`), and no shipped code adds its own document or window click listener, so cancelling the click earlier than the listener did changes nothing any other code observes.

## WeatherBacklog's handlers: removed

**Correction to the brief.** The brief's "v1.0.28 (stalled-reads-and-checklist-links): extended, unchanged" no longer holds for `WeatherBacklog.tsx`: its two v1.0.28 link handlers are removed. `openExternalLink` and its gate are still reused unchanged, and what the user gets in Missing Weather is the same (the same URL, opened once, from the row clicked), now sent by the shared components instead of by the tab.

Before this change, Missing Weather's rows passed `openChecklist` and `openEdit` (v1.0.28) to `ChecklistLink` and `OutboundLink`. With the components owning the same dispatch, those handlers sent the identical URL first and the shared handler then skipped the cancelled click: two mechanisms for one behavior, and a reader could not tell which was load-bearing. They are removed, with `checklistUrl` and `ChecklistLink`'s `onClick` prop, whose only caller they were. `OutboundLink` keeps accepting a caller `onClick` (it is a native anchor prop there).

`WeatherBacklogNativeActions.test.tsx` is unchanged and stays green, and it now exercises the shared owners through a real reordering, widening and paging list: deleting `OutboundLink`'s handler call turns both of its link rows red (M1). Action #3, Copy weather & go, is unchanged and still calls `openExternalUrl` with the row's `editUrl`.

## The guard: `lib/newTabLinkDispatch.test.ts`

A TypeScript-AST scan over every shipped `.ts`/`.tsx` under `frontend/src` (tests, `test-setup.ts` and `src/test/` excluded). Every JSX element whose `target` is `"_blank"` must:

1. have an `onClick` whose expression contains a call to `openNewTabLink`, resolved through an import from `lib/openExternal` (aliases accepted, a same-named local function refused);
2. pass that call the SAME expression the element renders as `href` (compared as source text, or as the literal for a string `href`), so the URL opened is the URL rendered;
3. have no spread attribute after the `onClick`, which could replace it.

A `target` that is not a literal is refused (the scan cannot tell whether it opens a new tab). Any other `_blank` literal in shipped source (a spread object, a DOM assignment, an HTML string) is reported, and the only one permitted is `openExternalUrl`'s web path in `lib/openExternal.ts`.

- **Comment immunity is structural.** A call written in a comment is not a call node, and an element in a JSX comment is not an element; a row proves each.
- **Population, not a count.** At least 11 sites (a floor), and each of the seven owner files must be reached. At the time of writing the scan finds exactly 11 sites, none failing, and one other literal (openExternal.ts:39).
- **Mutation-checked in the file itself:** one handler removed from the real `LifeListTable.tsx` source yields exactly one offender (`no onClick`) with the population unchanged.
- **Linearity:** one parse and one pre-order walk per file; the per-element work is bounded by that element's attributes and its `onClick` subtree. Linear in the source.

## Declared reads over user text

`openNewTabLink` parses a user-written URL from a comment (CommentText) with `new URL()`, once per click. It is not a scan over a file: the input is one URL segment `linkify` already isolated, and the WHATWG URL parser is a single-pass state machine, linear in the URL's length. It is also not new work: the plugin's listener ran the same `new URL()` on the same string on every such click before this change. Declared here per `.claude/rules/security.md` (an Improve-lane build declares such a read in its `decisions.md`).

## Security review riders (Auditor's informational notes, applied)

- **F1:** `EditCommentLink` now gates its id on `SUBMISSION_ID_RE` (renders nothing on a miss) and encodes it with `encodeURIComponent`, as its twin `EDIT_URL` in `WeatherBacklog.tsx` does; for every id that passes, the encoding is the identity, so a throwaway test showed the markup for `S1`, `S123456` and a 15-digit id equal to HEAD's inline JSX, and a new `WeatherTabLinks.test.tsx` row (`S1@evil.com` renders nothing) goes red with the gate removed.
- **F2:** `.claude/rules/security.md` `paths` now gates `frontend/src/lib/openExternal.ts` and `frontend/src/components/WeatherTabLinks*.tsx` (CLAUDE.md's same-change paths rule), beside the link components it already covered.

## Security posture

Unchanged. Every id-shape gate (`SUBMISSION_ID_RE`, `LOCATION_ID_RE`, `SPECIES_CODE_RE`) and every `encodeURIComponent` stays where it was. The same `plugin:opener|open_url` command, allowed by the existing `opener:default`, receives the same URL string. No third-party request, no new endpoint or host. What moves is where the IPC call is made from: the app's own handler instead of the plugin's injected listener, carrying the same string.

## Tests (fewest that prove it)

| Where | Row(s) | What it proves |
|---|---|---|
| `src/test/tauriOpener.ts` (new helper) | installs the IPC seam and a replica of the plugin's listener (tauri-plugin-opener 2.5.4 `init-iife.js`, logic unchanged); `calls()` reports each open as `own` (a string from the app) or `listener` (a URL object from the replica) | "opens once" is measured against the listener that would otherwise open a second time |
| `OutboundLink.test.tsx` | primary, Control and Shift clicks; Command, Alt, middle and secondary buttons; caller-cancelled; Enter; web and Pi; a row redrawn with `flushSync` inside the click, with a bare-anchor control | the gate in full on one owner, the resolved href, caller-first composition, and the redraw case, shown to matter by the control opening the wrong row through the listener |
| `ChecklistLink.test.tsx`, `SpeciesLinks.test.tsx` | one row each | each owner sends its own URL once and cancels |
| `CommentText.test.tsx` (new, no test file existed) | one row, three user URL shapes | the URL sent equals the anchor's resolved href, which differs from the text written |
| `LifeListTable.test.tsx` | one row, re-sorted between clicks | every new-tab link in a Multimedia row (four counts, two site marks) opens its own row's page before and after a re-sort |
| `targets/Targets.test.tsx` | one row, Alphabetical then Distance | each Last report hotspot link opens its own row's page across a re-sort that swaps the rows |
| `openExternal.test.ts` | two rows | an unparseable URL and a `javascript:` URL are left alone |
| `newTabLinkDispatch.test.ts` | 14 rows | the guard above and its own mutation checks |

Targets' `openExternal` mock now spreads the real module and fakes only `openExternalUrl`, so the hotspot links reach the real handler; the Tauri seam is installed only after the tab has rendered, so nothing else in the tab sees a Tauri platform.

**Every hand-written site now has a runtime row (QA fix).** The first hand-back left the Species Detail Macaulay link and the two App.tsx links to the guard alone, and QA showed why that was not enough: the guard proves the call is WRITTEN, not that it fires, and a handler broken so it cannot fire left the guard and suite green (QA mutations Q6, Q7). Added:
- `SpeciesDetailChecklistFrequency.test.tsx`: the tab rendered with an ML file and media for the species; a click on "1 photo on the Macaulay Library" sends exactly one `own` call with that link's href and cancels.
- `WeatherTabLinks.test.tsx` (new, beside the extracted component): the Edit checklist comment and SnowRaven Mini links, one row each. Rendering `App` was the alternative; no test mounts it today, and a harness for one click would mock most of the app, so the two anchors were extracted instead.

Each new row was proved against a handler that is written but cannot fire, snapshot and restore by file copy, hashes verified (the guard stayed green in all three, so only the runtime row catches it):

| Mutation | Red |
|---|---|
| Species Detail: `onClick={e => void (() => openNewTabLink(e, link))}` | the Species Detail row only |
| Edit link: the same shape | the Edit checklist comment row only |
| Mini link: handler given a non-primary event (QA's Q7 shape) | the SnowRaven Mini row only |

**Enter.** jsdom does not run a link's keyboard activation, so the row presses Enter (nothing opens: no key handler exists), then dispatches the click a browser generates for Enter (detail 0) and sees exactly one open. It proves there is no second, key-driven path; it does not prove a browser activates the link, which needs a real engine.

### Mutations (snapshot once, restore from it, verified by sha256)

Run over the nine affected test files (118 tests, all green at baseline):

| # | Mutation | Red |
|---|---|---|
| M1 | `OutboundLink` no longer calls the handler | 9: OutboundLink primary/Control/Shift, Enter, redraw; the guard; both WeatherBacklogNativeActions link rows; Targets |
| M2 | `openExternalLink` does not cancel the click | 11: every own-dispatch row (the replica opens a second time) |
| M3 | the raw `href` is sent, not the resolved one | 5: CommentText; OutboundLink primary/Control/Shift and Enter |
| M4 | `openExternalLink` loses its web/Pi no-op | 1: the web row |
| M5 | a cancelled click is dispatched | 2: the caller-cancelled row and openExternal's prevented row |
| M6 | a Command-click is dispatched | 2: the Command rows in OutboundLink and openExternal |
| M7 | the scheme gate is removed | 1: the `javascript:` row |
| M8 | an unparseable URL throws | 1: the unparseable row |

The files were restored from the snapshot after each mutation and their hashes matched it afterwards.

## Verification

- **Rendered markup byte-identical.** A throwaway test (deleted after use) dumped the rendered HTML of 14 scenarios (OutboundLink with string, rich and labeled children; HotspotLink full, truncate, compact and plain; ChecklistLink labeled, compact and junk; SpeciesLinks; CommentText raw and decoded; a Multimedia table row with all four counts), 19 new-tab anchors in all, at HEAD before any edit and again after. The two dumps are byte-identical (sha256 `36ee24b2...`). The existing `HotspotLink.unchanged.fixture.json` stays green.
- **Built CSS byte-identical.** `npm run build` at HEAD and after: `index-kngkoBkd.css` and `vendor-maplibre-CKRTiAqP.css` identical, same content hashes, so no word in the new comments or tests emitted a Tailwind rule.
- **The entry chunk moved (QA's measurement, recorded here).** `openExternal` left the entry chunk (minus 279 bytes) and joined the preloaded shared chunk that also holds `Link`, now named `openExternal-*.js` (plus 573 bytes): about 294 bytes more on first load, net. `index.html` still preloads it, `core` and `platform` were already preloaded, and `entryChunk.test.ts` is green.
- `npm run typecheck`, `npm run lint`, `npm run build` clean. `tabOrderCoverage.test.ts`, `entryChunk.test.ts` (re-run against the new build), `WeatherBacklogNativeActions.test.tsx`, `WeatherBacklog.test.tsx`, `HotspotLink.test.tsx` green. `vitest related --run` over the nine changed source files: 93 files, 1,597 tests green. The full frontend suite result is reported in the hand-back.

## Known limitations

- **Library-drawn anchors stay on the listener.** maplibre's attribution control draws its own new-tab links at runtime. They are not app source, are not in any sorted list, and the listener opens them correctly. The guard says it cannot see them.
- **No real-engine run in this stage.** jsdom stands in for the webview; the replica listener is copied from the plugin's 2.5.4 script. If the plugin is upgraded, re-derive the replica from its `init-iife.js`.
- **Not claimed:** this does not explain or fix the 1.0.28 Missing Weather collapse, which also hit Copy weather & go, a path that never used the listener (brief).
