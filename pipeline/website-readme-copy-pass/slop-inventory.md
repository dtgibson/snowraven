# Slop inventory and the guard constraint — website-readme-copy-pass

Input to The Engineer, beside the change brief. All figures measured at `d3c71d1`; re-derive
rather than trust them if rows have moved.

## THE BINDING CONSTRAINT: six guards read the two files being cut

All six `frontend/src/lib/*PublishedClaims.test.ts` suites read **both** `README.md` and
`website/index.html` (verified by grep, not inherited from the rule file, which still says
"third instance" and names three): `icloudKeys`, `namedBirdTimeline`, `palette`, `projects`,
`weatherStats`, `weatherTidePlan`.

Each scopes to its feature's own passage and **asserts the claim EXISTS before checking it is
right**, so deleting a sentence turns it red. That is deliberate: per
`.claude/rules/docs-and-website.md`, deletion "is the move an author under time pressure
actually reaches for, and it is the one a naive must-contain guard rewards." This pass IS that
author, with a legitimate mandate. Treat every red as a decision to put to the user, never a
guard to loosen.

Baseline: all six suites pass at `d3c71d1` (162 tests, run before any edit), so any red The
Engineer sees is attributable to the copy pass and not inherited.

**The README extraction anchors are exact bullet labels** (`split('\n').find(l =>
l.startsWith(...))`, so a renamed label yields `undefined`, not a softer match):

- `- **Weather & Tide Lookup**` (weatherTidePlan)
- `- **Weather, read back**` (weatherStats)
- `- **Weather on the bird's own page**` (weatherStats)
- `- **Named Birds**` (namedBirdTimeline)
- `- **Search anything by name**` (palette)

Website anchors are exact heading strings, e.g. `<h3>Search anything by name</h3>`,
`<h3>Named Birds</h3>`.

**Consequence, and it decides the build's shape.** The most attractive structural cut in README
is folding 18 bullets down to the 10 real tools — Weather is currently split across three
top-level bullets because three builds each appended their own. Two of those three labels are
guard anchors, and `- **Weather on the bird's own page**` is not even a surface name
(`TAB_LABELS` is authoritative; that card lives on **Species Detail**). So the choice is
explicit: keep the labels as anchors and tighten copy inside them, or update the guards'
anchors in the same change. The second is legitimate but must be deliberate and user-approved,
never incidental. Default to the first.

**Claims asserted inside passages are mechanism-level** — exactly what a copy pass wants to cut.
Named Birds, for instance, must keep a timeline mention, "which two dates" (or an equivalent),
"arrow keys", a phrase naming that a mark's sighting is read out, and the literal `last sighting
to today`, **in every file**. Do not work from this paragraph: run the six suites and enumerate
from the failures.

### Four traps that a phrase-by-phrase reading would miss

1. **Length floors, independent of content.** `weatherStats` requires the `- **Weather, read
   back**` and `- **Weather on the bird's own page**` bullets AND their two website paragraphs to
   each exceed **200 characters**; `weatherTidePlan` the same for the `- **Weather & Tide
   Lookup**` bullet and its paragraph; `namedBirdTimeline` **80** for its bullet and article. A
   trim that preserves every asserted phrase can still go red on length alone. These are floors
   on exactly the passages most in need of cutting.
2. **README bullets are single-line extractions.** `startsWith('- **…**')` returns one physical
   line, so re-flowing a long bullet across lines truncates the passage at the first newline and
   drops every claim after it. Bullets stay one line.
3. **The worst slop instance is byte-pinned in all three files.** `weatherTidePlan` requires
   seven sentences verbatim, including "On a wide window a Days in view choice above the chart
   fits one, three, seven or all of the plan's days into the chart at once, and two day buttons
   beside the legend move the chart a day at a time." and the ~40-word opening sentence, matched
   as exact whole-sentence equality. That is the single clearest case of HELP.md-grade mechanism
   detail on a decision surface, and it cannot be cut without editing the guard. Put it to the
   user explicitly at the gate; do not decide it inside the build.
4. **First-occurrence and file-wide traps.** The website's Planner passage is located by the
   FIRST occurrence of `Weather/tide Planner` anywhere in the file, so introducing an earlier
   mention (hero, nav, `meta description`) silently relocates the extraction. And three suites
   impose file-wide bans on `README.md` and `website/index.html`: no em dash, no `Predict` as a
   standalone word, no `Get forecast`. A rewrite of the Weather copy can reintroduce "Predict"
   without anyone noticing.

**Free to reword:** every `<h3>` except `<h3>Named Birds</h3>` and `<h3>Search anything by
name</h3>` (exact, no attributes permitted); and `- **Statistics**`, which is not an anchor —
only the geographic-parity sentence inside README line 14 is pinned.

**The version guard is weaker than its name suggests.** `it('the website version pill and footer
follow the app version')` is a whole-file `toContain('v' + package.json version)`, with no pill,
footer, class or `aria-label` anchor. `v1.0.32` occurs exactly twice (the pill text, the footer
line), so **deleting either one alone leaves the suite green**, and `aria-label="Version 1.0.32"`
cannot satisfy it at all (capital V, space). Verify all three sites by grep, never via the suite.

## Slop instances, by kind

**1. Offline as per-feature reassurance** (the user's own example). Asserted 13x in
`website/index.html`, 6x in `README.md`. There is already a dedicated `Offline support` article
that answers the question properly. The rest are reassurance: the features `<h2>` ("And they
work offline"), Calendar ("Entirely offline"), the Counties switch ("offline, from your own
file, no API key"), the map share pin, the Species Detail Weather card, the Statistics Weather
section, and the user's example at `website/index.html:502` / `README.md:24` — Search "makes no
network request and saves nothing, so it works offline and without an API key." Keep the
section, tightened; cut the scattered repetitions. Caution: at least one offline claim sits
inside a guarded passage (the rule file records that dropping the website's weather-stats
offline claim was mutation-verified red).

**2. Near-verbatim duplication.** "It ranks and recommends nothing" / "never predicts or ranks"
appears 3x in each file. "built from the backup you already loaded, so it makes no lookup and
works offline" appears twice in each, near-verbatim.

**3. Mechanism detail that belongs in HELP.md.** `website/index.html:188` is a single ~190-word
paragraph on the Weather/tide Planner, down to the Days-in-view choice and the two day-stepping
buttons beside the legend; `README.md:11` is the same content as a 260-word bullet. Statistics
carries five paragraphs, Map Explorer three, including "nothing is sent until you press."

**4. Enumerated data flows in the privacy band** (`website/index.html:127-138`): the keyless
sources (OpenStreetMap, map tiles, NOAA, Cornell Lab), the embedded-media setting, "There is no
SnowRaven server in the middle." `privacy.html` already carries all of it under its own
headings (Connections to Bird and Weather Services, Map Tiles, Embedded Bird Media, iCloud
Sync). Keep the band's plain claim and its link; delegate the enumeration. The four
`privacy-points` cards are structure, not prose — leave the cards, tighten their text.

**5. Padding and obvious statements.** "Nothing to sign up for. Just open it and go." "We run
nothing. There is no SnowRaven cloud." "No data entry, no busywork." "Zero analytics or
telemetry, on every platform." The `requirements` aside re-explains the whole iCloud Sync
feature a second time (`website/index.html:659-663`) after the privacy band already covered it.

**6. A count in published prose.** `<h2>Ten tools, one quiet workspace. And they work
offline</h2>` over a section holding 12 `<h3>` articles (10 tabs plus Search and Offline
support). Violates v1.0.16 on its own terms; state the property or drop the number.

## Already clean, do not "fix"

`grep -c '—'` is 0 in `README.md`, `website/index.html` and `website/privacy.html` — keep it
there. The en dashes in the List Comparer mock's placeholder cells are sanctioned. Both
surfaces already link `docs/HELP.md` and the privacy policy, so no new linking structure is
required; the only gap is that the website links Documentation from the footer only, so a
reader deep in the features section has no nearby link. Adding one is optional and, if it
means new markup rather than text, pushes toward a design pass.

---

## Pass 3 appendix: the from-scratch rewrite changes what the guards cost

Added at the Stage 1 re-entry. The body above still measures the surfaces correctly; what
follows supersedes its assumption that this is a trim.

**The guard-edit set is re-derived by measurement from zero.** `guard-edits.md` and
`superseded-pass2/` describe the set-aside pass-2 copy and are reference only. Do not port a row:
re-run the six suites against the new copy and enumerate from the failures, exactly as the body
says.

**The offline decision has a measured cost, and it is the one constraint the body did not carry.**
Removing every offline claim from the two decision surfaces reddens **six rows** (measured at
`d3c71d1`, three describe-blocks x the README and website rows of each):

| Suite | Block | Roster |
|---|---|---|
| `weatherStatsPublishedClaims` | `claim 3: offline, no lookup, on every surface that makes it` | `SURFACES` (HELP, README, website) |
| `weatherStatsPublishedClaims` | `card claim 4: no picker, offline, and no prediction` | `CARD_SURFACES` (HELP, README, website) |
| `weatherTidePlanPublishedClaims` | `claim 4: a plan loaded once re-shows offline with a cue` | `SURFACES`, byte-exact sentence |

Each asserts `toContain('offline')` plus `/no lookup|makes no network|no network request/` on the
lowercased passage; the planner row is whole-sentence equality on "A plan loaded once re-shows
offline with a cue naming when it was fetched." `icloudKeysPublishedClaims`'s offline assertion
reads `docs/HELP.md` only (`## Using SnowRaven offline`) and is unaffected, which is why the
offline FACT survives the copy decision.

**Two-tier repair, and only that.** `docs/HELP.md` keeps the byte-exact tier unweakened; the
README and website rows are retargeted to HELP alone, claim-level, still compared against each
other where two surfaces carry a claim. Pass 2 set the precedent by retargeting the Species
Detail card rows the same way. **No floor is lowered and no existence leg is deleted** -- every
surface keeps its assertion that a passage exists at all before any claim is checked, because
that leg is what makes deletion visible. Any red that cannot be repaired this way is a decision
for the user, never a guard to loosen.

**Anchors the rewrite will move, each a deliberate guard edit rather than a rider.** The website
`<h3>Weather &amp; Tide Lookup</h3>` becomes the `TAB_LABELS` name if the sections follow the
tabs; `<h3>Search anything by name</h3>` is pinned exact with no attributes permitted, so
renaming that section to **Search** is a `palettePublishedClaims` edit; and the website planner
passage is still located by the FIRST occurrence of `Weather/tide Planner` anywhere in the file,
so a from-scratch hero or meta description that mentions it silently relocates the extraction.

**Retiring the `Offline support` article retires its mock too.** The article is the last of the
12 `feature-row`s and carries a hand-built no-signal `feature-mock`. Under v1.0.20 a published
mock is a behavioural claim, so this is a decision for the user (recorded in the brief), and any
mock the Designer keeps or re-purposes is re-derived through the real code rather than eyeballed.
