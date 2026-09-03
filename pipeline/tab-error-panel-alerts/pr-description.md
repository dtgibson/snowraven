## Tab load-failure alerts that actually announce

### What this does

All eight data tabs (Statistics, Calendar, Checklists, Breeding Codes, Named Birds, Species Detail, Multimedia, Map Explorer) now announce a failed load of the stored eBird backup or Macaulay Library export to screen readers.

Six of the eight had no live region at all. The two that did (`Calendar.tsx:913`, `MapExplorer.tsx:3224`) carried `role="alert"` on a panel that is an early `return` in a phase switch, so the region was **created at the instant its text existed** — the repo's documented insert-with-first-message trap (DECISIONS.md v0.5.83, `.claude/rules/ui.md`). Those two are corrected here rather than copied.

The repair is structural, not an attribute addition. One shared component, `components/ui/TabLoadErrorAlert.tsx`, renders an always-mounted frame and an always-mounted `role="alert"` region and fills them afterwards. Each tab mounts it at fragment index 0 of every branch that can reach the error phase, so React reconciles it to the **same DOM node** across every phase transition.

Nothing changes visually. Populated, the three elements carry byte-identical inline styles to the eight panels that shipped before; idle, they carry no styles and no content and compute to zero height.

### How to test

`pipeline/tab-error-panel-alerts/how-to-see.md` has the click-by-click version. In short: with a backup saved, replace `data/ebird-backup.csv` with something unreadable, reopen each tab, and confirm the panel looks exactly as it did before. The announcement itself needs a screen reader (see Known limitations).

Automated:

```
cd frontend && npm run typecheck && npm run build && npx eslint . && npx vitest run
cd backend && ./.venv/bin/python -m pytest tests/ -q
```

### Notes for reviewer

**The assertion that matters is node identity.** `components/TabLoadErrorAlert.test.tsx` mounts all eight tabs from **one roster**, captures the region element before the failure, and asserts the element carrying the message afterwards `toBe` the same object. A build that moves the region back inside the phase switch still renders a correct `role="alert"` with the right text and passes any presence or `textContent` check — it fails only on identity. Mutation-checked in five forms, each red on exactly the right row:

| Mutation | Result |
|---|---|
| Checklists renders the region only in the error branch | 2 rows red |
| MapExplorer's loading early return restored | 1 row red |
| BirdingStats' ready-side mount removed | 1 row red |
| `!isLoadingSaved` dropped from MapExplorer's FAB gate | loading-view test red |
| `:empty { display: none }` added to `globals.css` | CSS guard red |

**Two tabs needed more than the gate, and the reason is per-tab rather than stylistic.** Six tabs reset the phase to a loading phase as the first statement of every reload, so `error` is only ever entered from a phase the gate renders. Statistics and the Map Explorer do **not** reset, so a files-epoch reload can go `ready -> error` in one commit. Statistics therefore mounts the region in its ready return too (one `loadAlert` const, two placements); the Map Explorer's region sits in its always-rendered map area. The roster's third test states the property both mechanisms must satisfy — the region exists and is empty in the commit before the message — rather than the mechanism, so it stays honest if a load effect changes.

**The Map Explorer restructure is the one risky part of this change.** Its loading phase was a bare early return of a centred spinner, which is why its region had nowhere to live before the message. That return is folded into the main tree: the mode bar and sidebar are gated on the phase, `mapMounted` is false while loading, and the spinner renders in the map area. Two FAB-cluster controls are *not* covered by `mapMounted` (fullscreen gates on `onToggleFullscreen`, the Filters pill on nothing) and would have newly appeared over an empty map area on a phone; `!isLoadingSaved` joins the shipped `!sidebarOpen` gate to stop that. A dedicated test pins "spinner and nothing else" with `onToggleFullscreen` supplied, which is how App renders it. The cluster **wrapper** stays unconditional, per the v0.5.83 contract that keeps its own geo-error region in the tree.

**Two claims in the change brief were wrong and are corrected in the code comments rather than quietly inherited.**
1. *"lucide sets no `aria-hidden` by default."* lucide-react 1.14 adds `aria-hidden="true"` itself for an icon with no children and no a11y prop (`!children && !hasA11yProp(rest)`), so the four icons that lacked an explicit one were already hidden at runtime. The prop is set explicitly anyway — it makes the guarantee this component's rather than a dependency's default — but this is **not** a bug fix and nothing a user could hear was different. The test says so in its own comment: it asserts the guarantee, and cannot currently discriminate the explicit prop.
2. *"a bare `<svg>` pollutes the `textContent`."* An `<svg>` of paths contributes nothing to `textContent`. What was real is that both shipped precedents put `role="alert"` on the outer panel, so **"Go to Settings" was part of the announced text**. The region is now the message box only, and the action button is its sibling.

**The keyed child is keyed on the message, not a sequence counter.** v0.5.80's counter exists so one control pressed twice announces twice; there is no control here, and a counter would have to be state — advancing it in an effect is what `react-hooks/set-state-in-effect` (build-blocking) forbids, and advancing it during render is impure. Per the ui.md honesty rule, the component says outright that **the key rejects nothing today**: the message node unmounts whenever the region empties, so every reachable repeat is already a real DOM addition, and what carries the announcement is the region-stability assertion. It also records the one transition that deliberately does *not* re-announce (an identical message replacing itself with the region never emptied), because nothing observable changed.

**`display: none` on any of the three elements would silently switch every announcement off, and jsdom cannot see it** — the whole component suite passes on that broken build. `lib/tabLoadAlertCss.test.ts` is the stylesheet half: three selectors (hiding an ancestor removes the region just as completely), exact selector comparison, an all-depth scan, a positive `display: flex` so the scan cannot pass vacuously, and two guard-the-guards.

**One existing test was amended, not deleted.** `MapExplorerSearchThisArea.test.tsx` asserted "no `[role=alert]` anywhere" as a proxy for "no error state". Since the region is now mounted and idle in every phase, that presence check would be asserting the defect this change fixes; it now asserts no alert region carries text.

**Verified:** typecheck, `npm run build`, `npx eslint .` all clean; 4352 frontend tests and 311 backend tests pass; `weft-design-lint` reports zero `warn` findings and nothing on the new files. `globals.css` gained a benign anchor block; a controlled build A/B confirmed the guard test's `collapse` token emits no new Tailwind rule (already in the corpus, byte- and hash-identical output).

### Known limitations

- **The announcement itself is unverified.** An accessibility tree is a proxy for an announcement, never proof of one. No screen reader and no human listener were available in this run, and macOS/iOS WebKit — the engines the desktop and iOS apps ship on — are exactly where an inserted-populated alert is least reliable. `ACCESSIBILITY.md` records this rather than claiming it.
- **The brief asked for an `ariaSnapshot` of the idle region in Chromium and WebKit. Not done.** The guarantee is instead asserted by node identity in jsdom plus the stylesheet scan. That pair covers the two mechanisms that break it, but neither is a real accessibility tree.
- **A tab you have not opened is not announced.** Unopened tab panels are `display: none` and out of the accessibility tree entirely. Pre-existing and out of scope; now stated in `ACCESSIBILITY.md`.

### Docs

`ACCESSIBILITY.md` updated (Screen Reader Support and Known Exceptions). `CHANGELOG.md` gains an entry in the existing 1.0.15 section; the version was already 1.0.15 in `frontend/package.json`, `src-tauri/tauri.conf.json` and the website pill, and was **not** bumped again. `docs/HELP.md`, `README.md` and `website/` were checked and are not implicated: their only screen-reader sentences describe the location button and "Search this area", both untouched.

## Convention Flags

- A live region and every element between it and the tab must be mounted before the message, so the shared component owns the frame and the region together and the stylesheet guard covers all three selectors — hiding an ancestor removes the region as completely as hiding the region.
- Where a tab's load effect does not reset to a loading phase before reloading, `ready -> error` is one commit, and that tab needs the region in its ready render too. The property to test is "the region existed, empty, in the commit before the message", not the mechanism that provides it.
- A `role="alert"` region should hold the sentence and nothing else: an action button belongs outside it, or its label is read as part of the failure.
- lucide-react 1.14 adds `aria-hidden="true"` to a childless icon with no a11y prop. Repo notes saying otherwise are out of date, and a test asserting an icon is hidden cannot currently discriminate an explicit prop.
