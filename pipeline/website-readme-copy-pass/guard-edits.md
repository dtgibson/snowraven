# Guard edits: website-readme-copy-pass (pass 3, from scratch)

The exact test changes this copy needs, each with the assertion today, the assertion proposed,
and why it is still a real guard afterwards.

**Derived by measurement from zero**, as the brief and the slop inventory's Pass 3 appendix both
require. Nothing was ported from the set-aside pass-2 work in `superseded-pass2/`. The new copy
went into an isolated worktree and the HEAD guards ran against it:

> **49 row failures across 5 suites, plus a whole-file collection error in the sixth.**

`palettePublishedClaims` fails at **module load** rather than per row, because its `SURFACES`
const calls the extractors at top level and a missing anchor throws before any row runs. That is
worth naming: the row count understates the damage, and a suite can fail in a way a row tally does
not show.

## Runs

| Run | Guards | Content | Result |
|---|---|---|---|
| A3 | HEAD | pass-3 copy + both HELP additions | **RED**, 49 rows / 5 suites + 1 collection error |
| B3 | pass-3 | pass-3 copy + both HELP additions | **GREEN**, 148 rows |
| C3 | pass-3 | same, after a README length trim | **GREEN**, 148 rows |

**162 rows at HEAD, 148 now.** The delta: `palette` loses the two decision-surface rows from each
of its two claim blocks and gains three (the negative block), `weatherTidePlan` loses ten and
gains three, `weatherStats` loses eight and gains one, `namedBirdTimeline` loses three,
`projects` gains one, `icloudKeys` gains one.

**These edits are RED against the live files, by design**, because the README anchors move from
bullets to sections and two rows assert sentences `docs/HELP.md` does not yet carry. **The guard
edits, the copy, the stylesheet deletion and the HELP additions land in one commit.** They cannot
be staged separately.

## Mutation verification: 17 of 17 caught

Fresh snapshot at the pass-3 state, restore only from it, restore verified by sha256 against the
intended content plus a behavioural re-run, no `git checkout` inside the harness, and every
mutation asserts its pattern's occurrence count and that the file actually changed.

| Mutation | Result |
|---|---|
| M1 delete `It ranks and recommends nothing.` from README | RED, 2 rows |
| M2 re-word the planner opening on the website only | RED, 2 rows |
| M3 delete the horizon sentence from HELP | RED, 2 rows |
| M4 delete the Days-in-view sentence from HELP | RED, 2 rows |
| M5 delete the new no-species-picker sentence from HELP | RED, 1 row |
| M6 remove RainCrow from the moved website card paragraph | RED, 1 row |
| M7 **re-add a Search section to README** | RED, 1 row |
| M8 **re-add an Offline heading to the website** | RED, 1 row |
| M9 rename README's `### Weather` section | RED, 8 rows |
| M10 rename README's `### Species Detail` section | RED, 6 rows |
| M11 drop the off-by-default property from README's keys sentence | RED, 1 row |
| M12 remove the `Sync API keys` name from HELP | RED, 2 rows |
| M13 delete the parity sentence from HELP | RED, 1 row |
| M14 add an unconditional parity claim to README | RED, 2 rows |
| M15 remove `ordinary outcome for most species` from the website card | RED, 1 row |
| M16 delete the Search visible-scope qualifier from HELP | RED, 1 row |
| M17 remove the timeline mention from the website's Named Birds section | RED, 1 row |

M5, M6, M7, M8, M11 and M12 are the ones this pass added. They are the ones that prove the
retirements and the delegations are real rather than intentions.

## The two-tier shape, unchanged

`docs/HELP.md` is the detail tier and keeps every byte-exact sentence, unweakened. `README.md` and
`website/index.html` are the decision tier. Every claim still lives on at least one surface, every
surface keeps an existence assertion before any claim is checked, and where two surfaces still
carry a claim they are still compared against each other.

**Two things this pass does that a narrowing does not**, and the distinction matters because the
two look identical in a diff:

- **A surface LEAVES a roster** when it no longer makes the claim at all, by user decision. That is what happens to Search. It is different from deleting an existence leg while the passage still stands, which stays forbidden.
- **A claim MOVES SURFACES** when it had no detail-tier copy to fall back on. That is the no-picker fact, which gets a new HELP sentence so the delegation is real.

---

## 1. `palettePublishedClaims.test.ts`

### The two decision surfaces leave the roster

- **Today:** `SURFACES` is HELP, README and the website, built at module load from `helpSearchSection()`, `readmeSearchBullet()` and `siteSearchArticle()`.
- **Proposed:** `SURFACES` is `[docs/HELP.md]`. The two extractors are deleted with the passages they anchored on.
- **Why this is not a weakening:** Search is app-wide rather than a tab, and the user decided it is more functional than something a birder chooses the app for, so neither decision surface makes any claim about Search. A surface that makes no claim owes no assertion. HELP keeps its existence leg and both claims byte-for-byte, and HELP's `## Search` is richer than either retired passage ever was. M16 confirms HELP's own non-vacuity still goes red.
- One stale comment corrected: a row's note said "each of these three files makes the claim".

### The negative block (new, and the counter-pressure you asked for)

Three rows in a `describe` named for what it is:

1. `finds headings at all on both surfaces (non-vacuity for the ban below)`, which parses Markdown `##`/`###` and website `<h2>`/`<h3>` headings, requires more than five per surface, and requires five named tab headings to be among them. **A ban over an empty set passes against anything**, so this leg is what makes the next one mean something.
2. `neither surface carries a Search or an Offline section heading`.
3. `GUARD THE GUARD: the headings that were retired would be caught`, which checks the four retired spellings match and four ordinary headings do not.

**What it does not do**, stated in the file so it is not mistaken for more: it bans a section
HEADING, not a mention. A sentence using the word offline, or a link whose text is Search, is not
what went wrong and is not what this catches.

**Why both live here** rather than one in each owning suite: one discoverable block beats two
half-blocks, and they were retired by the same decision for the same reason.
`weatherStatsPublishedClaims` carries a pointer to it from its offline rows. M7 and M8 verify both
halves.

---

## 2. `weatherTidePlanPublishedClaims.test.ts`

### The README anchor becomes a section extractor

- **Today:** `readmePassage()` finds the line starting `- **Weather & Tide Lookup**`.
- **Proposed:** a `readmeSection('Weather')` helper reading `### Weather` to the next `###` or `##`.
- **A trap this retires, worth recording:** the old anchors were LINE extractions, so a passage stopped at the first newline and a bullet had to stay on one physical line however long it grew. That is part of how a 260-word bullet happened. A section extractor removes the pressure entirely. M9 confirms a renamed section goes red, loudly, across eight rows.

### Claims 1 and 4 to 8 retarget to `DETAIL_SURFACES`

| Claim | Why it is detail tier |
|---|---|
| 1, the horizon sentence | **Absurd negation.** A weather plan cannot reach past the weather forecast. On HELP it is paired with the fact that tide reaches further, which is what makes it documentation rather than a truism |
| 4, the offline re-show cue | Offline is unmentioned on both decision surfaces |
| 5, Days in view and the day buttons | A control, its four options and two buttons |
| 6, the timeline readout | How to operate a control; the keyboard half is guarded on `ACCESSIBILITY.md` by a row in this same file |
| 7, the sun track's anchoring | The anchoring is the mechanism; that the plan carries sun height stays in the shared opening sentence |
| 8, the moon phase's provenance | The provenance clause is what makes it documentation |

### The rename row splits

The two BANS (`/\bPredict\b/`, `Get forecast`) stay on all three surfaces and the file-wide bans
are untouched. Only the positive `a second action in Plan` moves to HELP: naming which on-screen
action a feature sits behind is telling a reader how to operate a screen they have never seen.

### The agreement block

`SHARED_CLAIMS` is now one member, `It ranks and recommends nothing.`, and that is the point rather
than an erosion: it is the claim a reader could not have guessed, and plenty of tools do rank
conditions, so its negation is not absurd. The decision surfaces' opening sentence is asserted
**equal to each other** rather than against a literal, so a re-wording must move both (M2). HELP
keeps its fuller opening byte-exact.

---

## 3. `weatherStatsPublishedClaims.test.ts`

### Two README anchors become section extractors

`- **Weather, read back**` becomes `### Statistics`; `- **Weather on the bird's own page**`
becomes `### Species Detail`. The second was never the name of anything on screen, which is the
append-log shape this pass exists to undo: a paragraph now lives in the section for the surface it
describes. M10 confirms.

### Offline and three card claims retarget to HELP

The section-level offline row and the card's offline, two-wholes and one-derivation rows move to
the detail tier. The card's `ordinary outcome for most species` row **stays on all three**, because
that claim sets an expectation a prospective reader needs (M15).

### The no-picker row returns, pointed at HELP

An earlier pass deleted this row and recorded the claim as published nowhere. The user's answer was
to keep the fact and move it, so `proposed/HELP-additions.md` adds one sentence to HELP's Species
Detail Weather bullet and the row returns matched as `/no species picker/` rather than against the
retired wording. Verified in the code, not against the old copy: `SpeciesWeatherCard.tsx:76` reads
"The tab's own selection. The card renders no control that could change it." M5 confirms.

### The website joins the both-apps attribution roster

- **Today:** the row loops `[CARD_SURFACES[0], CARD_SURFACES[1]]`, HELP and README, with a comment justifying the omission: "the website paragraph leans on the section paragraph directly above it for the attribution".
- **Proposed:** it loops all three.
- **Why:** that justification was true of the shipped page, where the card paragraph sat inside the STATISTICS article one paragraph below the section naming both apps. The design moves the card paragraph into Species Detail, where it belongs. Nothing is directly above it any more. **An exemption whose stated reason has evaporated is the most dangerous kind of green:** it keeps passing and it is no longer protecting anything. The website now names both apps in its own paragraph. M6 confirms.

---

## 4. `namedBirdTimelinePublishedClaims.test.ts`

README anchor becomes a `### Named Birds` section extractor (the label was already the
`TAB_LABELS` name). Three claims retarget to a `detailPassages()` helper: which two dates the
figure measures, the arrow keys and the readout, and the "Measure to" switch with its endpoint
phrase.

**One note left in the file for whoever retargets a row next.** An earlier attempt at the switch
row asserted `last sighting to today` on HELP. **HELP has never contained that string**: it was
the decision surfaces' own formulation, and HELP says "from its first sighting to today" and names
the switch's two settings. Retargeting is not a search-and-replace on the file name; the claim has
to be re-derived from what the new surface actually says. The row now builds from
`namedBirdTimelineCopy` (`rangeLabel`, `optLastSighting`, `optToday`, `endpoints('today')`).

What stays on all three: that a Named Birds passage exists per file, and that it names the
timelines (M17).

---

## 5. `projectsPublishedClaims.test.ts`

The existence leg splits off into `%s carries a parity sentence at all (non-vacuity)` over HELP
alone. The conditioning check and the unconditional ban still run over **all three** surfaces, so
a decision surface that makes the claim must still scope it and give the reason. Reconciling two
county numbers is documentation: it answers a question only a reader already holding both figures
can have. M13 and M14 verify both directions.

---

## 6. `icloudKeysPublishedClaims.test.ts`

- **Today:** one row requiring README to match `/\*\*Sync API keys\*\* switch/` and the website to carry the literal `A second switch, also off by default, can share your two API keys`, which lived in the install aside's iCloud paragraph.
- **Proposed:** two rows.
  1. `README and the website publish the key path as the reader's own choice`, which reads every sentence on each surface making an API-keys stays-local claim, requires at least one, requires the choice qualifier in that same sentence, **and requires the off-by-default property** that the dropped aside paragraph carried and the band did not.
  2. `the switches themselves are still named on the two surfaces that document them`, asserting `**Sync API keys**` in HELP and `Sync API keys` in `privacy.html`.
- **Why:** which switch governs which document is settings-page mechanism, invisible to someone who has not installed the app. What FR-50 and FR-51 need is that no decision surface claims keys stay local without saying the sharing is the reader's own choice, and that is now asserted per sentence, which is stronger than one literal: a new unqualified sentence anywhere goes red. M11 and M12 verify the property and the delegation.
- The `not.toContain('nothing else is synced')` ban is kept.

---

## No floor is lowered, measured rather than assumed

| Passage | Floor | Measured |
|---|---|---|
| README `### Weather` | 200 | 590 |
| README `### Statistics` | 200 | 842 |
| README `### Species Detail` | 200 | 741 |
| README `### Named Birds` | 80 | 351 |
| website planner paragraph | 200 | 324 |
| website Weather section paragraph | 200 | 389 |
| website card paragraph | 200 | 336 |
| website Named Birds article | 80 | 396 |

Every floor clears with room. **If one had bound I would have proposed changing the floor with its
justification rather than padding a sentence back out**; none did.

## File-wide bans, by grep on the proposed files

Zero em dashes, zero `/\bPredict\b/`, zero `Get forecast`, zero `nothing else is synced`, no
`SPECIES_CAP` value, both literal parity bans absent, on both files. `the predicted tide` stays
legal because the ban is case-sensitive.

## Three version sites, by grep rather than by the suite

Byte-identical: `v1.0.32` (2 occurrences), `aria-label="Version 1.0.32"` (1),
`class="footer-version">SnowRaven v1.0.32` (1). No version, manifest or changelog file is touched.

## Pre-push gate

`npm run build` green in the worktree, `eslint` clean on all six files, and the built CSS bundle
byte- and hash-identical to a HEAD build with a determinism control and a non-vacuous difference
control (`6 of 6 test files differ from HEAD`). The stylesheet change is to `website/styles.css`,
which is not part of the app bundle.
