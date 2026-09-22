# Change Brief — website-screenshot-sizing

## What is changing

The figure sizing in the features section of `website/index.html` and its rules in
`website/styles.css`, so each screenshot is scaled to the one-or-two-sentence paragraph
it now sits beside. Three measured defects: the Weather figure renders 784px tall against
262px of text (media/text 2.99) and makes row 1 the tallest row on the page at 887px; the
`reverse` alternation puts five of the ten figures in the narrow grid column, so identical
1600x900 assets render 446x252 in one row and 558x315 in the next; and the shortest rows
(Breeding Codes at 19 words, List Comparer at 19) carry the largest media, because figure
height is fixed by image aspect and does not follow copy length. Likely both CSS and one
re-captured asset (Weather). **No copy changes. Not one word, on either surface.**

## Why now

The copy pass (`11130b6`) cut every feature paragraph to one or two sentences and left the
figure rules untouched. The sizing was tuned when each row had a long paragraph to balance
it, so the rows that lost the most text now look the most lopsided. The Weather figure is a
second, compounding cause: `54f5a57` (v1.0.27) re-captured it to restore missing Weather
output and its aspect went from 1080x1385 to 1080x2021 in the process, which nothing
re-examined for sizing. Both changes were correct in isolation and the section was never
read whole afterwards, which is the same append-without-re-reading mechanism DECISIONS.md
records for the README at v1.0.10.

## User-facing impact

Visual only, on the public marketing site. No app behavior, no published factual claim, no
change to any sentence a reader reads. The version pill and footer version stay at v1.0.32
(the four-file parity guard asserts them against `frontend/package.json`). If Weather is
re-captured, the visible content of that screenshot changes shape but must keep the Weather
output that `54f5a57` existed to restore, and the alt text stays accurate to the new frame.

## Design pass

**Needed.** It is not a one-rule correction: it needs a stated relationship between media
size and a short paragraph across ten rows, a decision on the `reverse` column inversion
that keeps the parity DECISIONS.md fixed (odd rows media-right, even rows reverse) rather
than un-reversing rows, a shape decision for the Weather asset, and a call on the 320px
tier, where the mismatch inverts: real screenshots shrink to 161px tall (unreadable at
0.18x) while the two hand-built mocks stay the tallest media in the section at 242px and
333px. Surfaces refined, named from `TAB_LABELS`: Weather, Statistics, Map Explorer,
Species Detail, Calendar, Multimedia, Breeding Codes, Checklists, List Comparer, Named
Birds, plus the Statistics phone figure in the Platforms section.

## Decisions touched

- **2026-09-21 website-readme-copy-pass** (DECISIONS.md line 7): copy locked, no byte of
  prose rewritten, pill stays v1.0.32, and that entry's alternation parity is preserved.
- **v1.0.20, a published mock is a behavioural claim**: the Checklists and List Comparer
  mocks may be re-sized; changing their content would re-open that check.
- **v1.0.27 `weather-screenshot-recapture`**: an asset and its declared dimensions land
  atomically. One violation is in scope: `statistics-mobile.webp` is 560x1226, declares 1198.
- **v1.0.4 demo data / `SR_DATA_DIR`** and "never ship stale screenshots": a capture runs
  through `website/tools` against demo data, from the current built app. **v1.0.29**: a
  visible surface gets a live look at the built thing before the deploy gate.

## What done looks like

Every feature row reads as one unit at 1280px: no figure towers over its paragraph, and two
rows carrying the same asset shape render at the same size. Row 1 is no longer 2.1x the
next tallest row. At 375px and 320px the page still has no horizontal overflow (it has none
today) and screenshots are not postage stamps beside oversized mocks. `statistics-mobile`
declares its true 560x1226. The six `*PublishedClaims` suites and the four-file version
parity guard stay green. **The deploy gate for this bundle includes a before/after preview
of the site served over the tailnet (never file:// or localhost), structure first, for the
user to read and approve: no byte of `website/` goes live without that yes.**
