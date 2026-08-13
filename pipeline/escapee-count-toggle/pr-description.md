## Escapee Count Toggle

### What this does

The Statistics species total counted eBird "escapee" birds that eBird itself
excludes from a life list, so the headline figure read higher than the number a
birder quotes and compares. This adds a **Count escapees** checkbox beneath the
existing "Count spuh, slash & hybrids" control, off by default, so the total
follows eBird's own rule: **Exotic: Provisional and Exotic: Naturalized count,
Exotic: Escapee does not.**

Behind it, SnowRaven resolves exotic provenance for the species in the birder's
own export. Provenance is a per-observation eBird fact (`exoticCategory`), the
question is per species, and the answer is a monotone OR: a species counts if at
least one of its observations is not `X`. One checklist call returns provenance
for every species on that checklist at once, which makes this a **set cover over
data the app already holds**, not a sweep. The cover is computed offline from the
CSV, fetched through the existing `/checklists/{id}` seam, and cached for 30
days. On the reference export that is **73 checklists, about ten seconds** at
concurrency 4, and the total goes **267 to 264** (Graylag Goose, Swan Goose,
Muscovy Duck).

### How to test

The step-by-step is in `pipeline/escapee-count-toggle/how-to-see.md`. In short:
open Statistics with an eBird key and a connection, watch the definite "N of 73"
progress line under the Species figure settle, then toggle "Count escapees" and
confirm the figure moves between 264 and 267 and the disclosure names the three
birds.

### Notes for reviewer

**The one thing most worth checking is the anti-shortcut guard.** The offline
`category === 'domestic'` heuristic is wrong in both directions: Red Junglefowl
returns `N` and Indian Peafowl `P`, and eBird counts both. If either disappears
from the total, the shortcut was built instead of the real rule. That is a
falsifiable success criterion, and
`exoticProvenance.test.ts` → "the taxonomy category field can never decide
countability" is the guard.

**Carried decisions implemented, not revisited.**

- **An unresolved species counts** (FR-04). A species is removed only once every
  checklist carrying it has been consulted and every one came back `X`. So the
  figure converges downward and never wrongly erases a lifer.
- **The shipped gate is the explicit `exoticCategory === 'X'` test.**
  `userDoNotCount` is recorded in the cache but never consulted (FR-08 / OQ-01).
  The cache stores the raw `"<category>|<doNotCount>"` pair rather than a derived
  boolean, because OQ-01 is a question about the *pairing* and a presence flag
  could not answer it. A test asserts that removing the companion flag from every
  token changes no classification.
- **Join on `speciesCode`.** Names map to codes once, in one direction. There is
  no code → name → code round trip anywhere.

**Two things the seam needed.** Both transports dropped `exoticCategory`
entirely, so `frontend/src/lib/tauri/checklistService.ts` and
`backend/services/ebird.py` + `routers/checklists.py` gained **both**
`exoticCategory` and `userDoNotCount` (a superset of FR-39, because OQ-01's
default resolution needs the companion field recorded). Normalization is written
with **explicit ASCII classes** on both sides, and the shared fixture
`checklistProvenance.fixture.json` drives a parity test on each transport
carrying an Arabic-Indic digit run and a Cyrillic capital: the v0.5.54 trap was a
rust-regex `\d` admitting `٠١٢` while its JS twin did not. Separately,
`fields=provenance` is a flag on the **existing path**, not a new endpoint: it
suppresses the second per-checklist eBird call the seam otherwise makes to
resolve a location name a provenance pass does not need (FR-13). The response
shape is unchanged either way.

**The Calendar's zero-network guarantee is enforced by the import graph, not by
discipline.** `useProvenanceLookup.ts`, `exoticProvenanceCache.ts`,
`exoticProvenance.ts` and `exoticCopy.ts` cannot statically reach `transport` or
any `lib/tauri/*Service`; `exoticProvenanceGraph.test.ts` walks the closure and
fails if that ever changes, and it carries a guard-the-guard pointing the same
walker at the controller so a broken matcher cannot report a clean result for
everything. That test also found a real defect in its own first draft: the word
"export" inside a prose comment in `exoticCopy.ts` hijacked the lazy specifier
match and made a dependency-free module appear to import `transport.ts`. The
walker now strips comments, the same class of fix the CSS guards' shared parser
already carries.

**The passive half needed one addition to the persisted shape, and it is worth a
look.** The Calendar holds no name-to-code join and may not fetch one, so it
cannot classify by code. The document therefore carries `excludedNames`, the
escapee-only classification **published by the Statistics pass**, and it is
explicitly a cache of a derivation rather than the source of truth: `species`
still holds the raw tokens and Statistics always re-derives from them. A passive
reader does not trust that list, it **confirms** it against the persisted
checklist ledger using its own observations, so a newly loaded export that adds a
carrier re-opens the species offline exactly as it does on Statistics (FR-25).

**Two retention policies, deliberately opposite** (schema §4), and the tests
measure both at **capacity plus one** and assert **work done** rather than
elapsed time. The checklist ledger is FIFO because an eviction costs one
redundant request and loses no answer. The species index uses admission control
because an eviction would destroy a paid-for network answer and, at capacity+1,
would do so on every pass forever. Admission is gated on the container's own
size, never a separate counter, and a test re-merges one species fifty times to
prove admission capacity is not silently consumed.

**Approved PRD deviation, implemented on purpose.** FR-31 gives only the error
state a retry. This ships "Check again" on all four `partial` reasons as well
(raised and approved at the design gate, 2026-08-12): a birder who presses Stop
otherwise has no route back, and because a tab stays mounted once opened,
`partial (cancelled)` would persist for the rest of the session. The test naming
it says it is intended behaviour, not a defect against FR-31.

**Three mockup-fixed overflow defects are not reintroduced**, and page
`scrollWidth` is deliberately not used to check any of them (it read a clean 320
on the broken build). The evidence line wraps, the progress row is conditionally
rendered rather than `hidden` against an author `display`, and no fixed grid
track was added. `exoticAccountCss.test.ts` parses the real stylesheet for the
wrap and for the one claim jsdom structurally cannot make: that **no rule at any
depth hides the live region**, because `display: none` on a `role="status"`
removes it from the accessibility tree and makes it be inserted with its first
message. That guard uses the all-depth AST walk (an absence claim), carries a
positive `display: flex` assertion so it cannot pass vacuously, and mutation-checks
its own hiding matcher.

### Fixed during QA round 1

Both acceptance failures QA reported were test-coverage defects with correct
shipped copy, and both are now guarded by assertions that were mutation-checked
against the exact defect described.

- **QA-46**: `CountyCompletenessUI.test.tsx` asserted the new caption only in the
  ready branch; the degraded-states branch asserted the unchanged
  `recorded N countable species here` prefix, which matched a build with the rule
  sentence stripped. Verified: stripping the sentence from *either* caption now
  turns the suite red on its own.
- **QA-38**: `COUNT_RULE_SENTENCE` had zero coverage on any of its three
  surfaces. New file `components/exoticCrossTabSentence.test.tsx` covers Calendar,
  Frivolous Lists, and Multimedia with a render/absent pair each, plus a
  guard-the-guard that flips the Multimedia flag against an unchanged stats
  object. Four mutations verified red: `{false && (` on each of the three
  surfaces, and Calendar dropping the passive hook entirely. The Calendar case
  drives the real hook through the real store rather than mocking it, so it also
  covers `confirmExcludedNames` re-opening a species offline.
- **QA-21**: added `setMaxRequestsPerPass`, matching how the cache caps are
  already made testable, plus five tests. **This turned up a real boundary
  defect, and it is a behaviour change rather than a test-only fix.** A pass
  whose cover happened to equal the cap exactly was reported as
  `partial` / `pass-budget` even though it had in fact finished, because the cap
  was being decided at two points that could disagree. The post-round assignment
  is removed; the loop head already decides it correctly (empty `remaining`
  breaks with no reason, a spent budget with work left sets the reason). One
  decision point, not two.

  One mutation there survived and is documented at the source rather than left
  silent: the worker's own `issued >= MAX_REQUESTS_PER_PASS` check is not
  independently reachable, because `greedyCover` is handed `budget` so a wave can
  never exceed the requests still allowed. The line stays as defence in depth,
  and the invariant that makes it unreachable is now pinned by a multi-round
  follow-up test that a "budget from the round, not the running total" mutation
  turns red.
- **NFR-01's in-code figure** said "~2 ms, roughly 200x", which was one
  optimistic reading stated as a fact. Re-measured over nine fresh-salt runs
  through the module: min 3.38 ms, median 4.32 ms, worst 6.62 ms on an Apple M1
  Pro (node 24), which agrees with QA's independent ~4.2 ms / 9.64 ms worst. The
  comment now states the range and names the machine; the assertion is unchanged
  and still sits ~7x above the worst reading either run produced.
- **QA-47 passed vacuously**: the website described the toggle without any
  duration claim, while using "per-session, resetting on relaunch" for two
  sibling toggles on the same page. The sentence is added.

### Fixed after the security audit (PASSED WITH NOTES, four findings)

- **Medium, anchor parity.** The two transports' validators genuinely disagreed,
  and the comment on both asserted they did not. The character classes matched;
  the anchors did not. Python's `$` matches before a trailing newline and
  JavaScript's does not, so `re.match(r"^[A-Z]{1,4}$", "X\n")` accepted a value
  its `.test()` twin rejected. The token counted on both sides, so no species
  could be wrongly dropped, but `"X\n"` then failed the store's own
  `SEEN_TOKEN_RE` on reload, silently discarding the whole species record and
  re-fetching it every session on web/Pi. Backend now uses `fullmatch`; the
  shared fixture gained trailing-, leading- and embedded-newline rows; both
  parity tests assert the anchors directly. Mutation-verified: reverting to
  `.match()` turns three Python tests red. **The general lesson is in the fixture
  header** — matching character classes are only half of parity, and a twinned
  pattern needs a trailing-newline row.
- **Medium, collapsed panel focusables.** The disclosure panel is clipped by
  `grid-template-rows`, not unmounted, so its contents stayed in the tab order
  and the accessibility tree while `aria-expanded="false"` said otherwise (WCAG
  2.4.3, 4.1.2). Measured here at exactly **9** focusables, matching the
  Auditor's count. Fixed with `inert` on the clipped inner div, which is the same
  fix on the same grid-rows shape as the Map Explorer's collapsed filter panel.
  The Auditor's note that this is NOT the "Show all N counties" idiom is now
  written into both the component and the CSS: that idiom conditionally renders
  and is the source of the expander BUTTON's styling only.
- **Medium, false privacy sentence.** "This is the one place where a number is
  derived from a live lookup" was untrue, in the direction that makes the app
  look less networked than it is. Grepped the predicate before rewriting, per
  CLAUDE.md, and found two counter-examples: county Completeness has rendered
  `X of Y species · Z%` from a live call since v0.5.54, and hotspot popups show a
  live species count. The sentence now states what is actually new (a figure
  summarizing your own history depends on a lookup, on a tab that was previously
  computed entirely on-device) and names the existing cases rather than implying
  they do not exist.
- **Low, announcement rate.** The live region announced 75 times over a 9.7 s
  pass, about 7.7 per second, because the sequence-keyed child fired per request.
  Throttled the **emission** rather than the announcement
  (`PROGRESS_ANNOUNCE_INTERVAL_MS`, 2 s), which keeps one source of truth so the
  sentence, the bar and the `N / M` readout cannot disagree on screen. The region
  is still always rendered, still never `display: none` while idle, and still
  uses the sequence-keyed child. Terminal statuses and the first definite figure
  are never throttled. Mutation-verified in both directions: removing the
  throttle goes red, and throttling the opening figure goes red.

**Two follow-ups after the audit re-run.**

- **QA-49 again.** The first repair replaced an over-claim with a different false
  clause: "the Statistics tab was previously computed entirely on your device".
  The tab has been networked all along, and the PRD had recorded this exact point
  under "Context The Architect And The Engineer Must Not Re-Derive" (what changes
  is that a *displayed number* becomes network-derived, not that the tab starts
  talking to eBird). I restated the half the PRD warned against. Re-grepped both
  call sites rather than reasoning from the tab's general character:
  `BirdingStats.tsx:164` posts the species list to `/taxonomy/codes` and
  `BirdingStats.tsx:102` fetches `/map/hotspot-region` via `useHotspotSet()`. The
  clause now scopes the claim to the tab's *displayed numbers*, discloses both
  pre-existing requests, and adds a fact the trace turned up that a reader of
  this page would want: the species names are matched against a copy of the
  taxonomy the app already holds (`_by_sci` / `_by_com` in
  `routers/taxonomy.py`), so the list is **not** sent to eBird. eBird is
  contacted only for the taxonomy itself, which carries no user data.
- **A test gap on the throttle's `force` flag.** Making the emitter ignore
  `force` left all 26 controller tests green. The behaviour was correct, so this
  was a finding about the test: `lastEmit` starts at 0, so the first emission of
  any pass clears the interval on its own, leaving the opening figure protected
  by two overlapping mechanisms of which `force` is only one. What `force`
  uniquely protects is a follow-up wave discovered *inside* the window, where the
  sentence gains its "plus N follow-up checks" clause milliseconds after the
  opening emission. That clause's rendering was covered; its prompt emission was
  not. Added the guard, and mutation-confirmed it is the only test that catches
  the flag being ignored.

Both informational items were considered. `consultedSet`'s bare index is now
`Object.hasOwn`-guarded: it was safe by invariant but was the single outlier in a
module where every other read is guarded, and that inconsistency is what teaches
the next reader the wrong lesson. The backend's 502 detail is left as-is with the
reasoning recorded at the site: the key rides in a header and never appears in
the reflected string, the detail is load-bearing for the Life List Comparer which
displays it, and narrowing a shared error surface for another feature is not
something to do inside a provenance change. The provenance pass never surfaces
that text; it only counts the failure.

One unrelated repair fell out of the throttle work. The shared `setStatus`
`useCallback` had to be named as a dependency of both the pass and the auto-start
effect, and `react-hooks/set-state-in-effect` then traced the effect into it and
reported a synchronous setState that does not exist. Replaced with a ref-held
emitter closing over React's own `setState`, which is stable and exempt, so both
dependency arrays are empty and the rule is satisfied by construction rather than
by suppression.

### Named limits and residual asymmetries, stated rather than hidden

- **County Completeness applies the rule to the numerator only.** The denominator
  is eBird's regional species list and is not filtered, because filtering it
  would mean classifying every species eBird publishes for a region, a different
  and much larger question. The popup caption now says so in words, which is also
  the FR-40 fix: it no longer claims there are exactly three kinds of excluded
  form. Documented at the `buildCountyCompletenessLocal` call site.
- **Statistics' Geographic Stats per-county species counts are NOT in scope** and
  therefore no longer agree exactly with the Map Explorer's Completeness
  numerator, which they were aligned with in v0.5.86. FR-30 scopes the toggle to
  the headline and milestones and FR-34 does not list Statistics geo, so widening
  it here would have been unapproved scope. Flagged for the Chronicler; it is a
  deliberate omission, not an oversight.
- **A published escapee name is only as current as the last Statistics visit for
  species the passive reader cannot re-open.** The confirmation step covers the
  case that matters (a new carrier re-opens a species offline); a species whose
  classification changes for any other reason updates on the next Statistics
  visit.
- **`accumulationPair` computes the milestone series twice when anything is
  excluded.** That is the point: both series are produced in one memo pass and
  the toggle selects at read, so toggling never invalidates a memo input
  (NFR-02). With nothing excluded the second series *is* the first, by reference.

### Measurements

| | |
|---|---|
| Cover on a 21,369-row, 3,252-checklist fixture | well under the 500 ms ceiling; the guard asserts the **margin** (< 50 ms), not merely the ceiling, and uses a **distinct input per timed run** so it cannot measure a memo hit |
| Scaling | a linearity check at 20k and 40k rows rejects a quadratic implementation |
| Concurrency | peak in flight measured at the transport seam, `<= 4` and `> 1` |
| Requests per checklist | exactly one, every one carrying `fields=provenance` |
| Entry chunk | unchanged; no maplibre, county geometry, or provenance module in `dist/index.html`'s modulepreload |
| Built CSS | `.invert` / `.isolate` absent, so no Tailwind utility was accidentally emitted from a new test file's prose |

### Verification run

Frontend 2,498 tests across 177 files, backend 210 tests, `eslint` clean,
`ruff` clean, `npm run build` clean, entry chunk unchanged.

## Convention Flags

- **A published, denormalized classification field is a legitimate member of a
  persistent cache document when a passive reader structurally cannot re-derive
  it, provided the raw evidence stays the source of truth and the reader
  CONFIRMS rather than trusts it.** `ProvenanceSnapshot.excludedNames` is the
  reference: Statistics publishes, the Calendar confirms against the persisted
  ledger using its own data, and the raw tokens are never replaced by the derived
  form. Without the confirmation step this would be a stale-cache trap; with it,
  the offline reader tracks a newly loaded export correctly.
- **A graph-walking test that scans source text must strip comments first.** The
  word "import" or "export" in prose starts a lazy specifier match that runs
  forward to the next real `from '...'` and reports an edge that does not exist.
  It happened here on the first run. `entryChunk.test.ts` carries the same latent
  weakness.
- **Where a repo convention and an approved artifact disagree on which predicate
  a call site takes, the convention wins and the deviation is stated in code.**
  `schema.md` §7 specified `isNonCountableSpecies(norm)` for the cover index;
  CLAUDE.md's raw-versus-normalized rule requires `isNonCountableObservedName`
  at a site holding a raw CSV name, which also keeps countable intergrades in the
  cover. Implemented per the convention, with the reason at the call site.
