# Change Brief — touch-a11y-followups

## What is changing
Three hover-only / touch-inert affordances from the v0.5.55 mobile-prep audit,
resolved for sighted touch users using existing patterns:

- **#26 Breeding Codes — meanings become visible text in the legend.** The
  BreedingCodeTable legend footer (and the BreedingCodeList filter-pill legend,
  brought along for consistency) currently shows only the tier label + bare codes
  (e.g. `Confirmed: NY NE FY`). Each present code gains its full meaning as
  visible text (e.g. `NY Nest with Young`), reusing the label already in
  `BREEDING_CODE_MAP` / the `title` attribute. No new component; the meaning
  becomes readable without hover. Existing `aria-label`s are untouched.

- **#27 List Comparer — media counts visible on phones.** `MediaIcons` show their
  count as visible text next to the icon on the ≤640 phone tier (base-hidden /
  shown-at-phone, mirroring the existing `.sr-sidecell-tag` idiom in the same
  file). The `BreedingBadge` full LABEL is deliberately left to the #26 legend —
  a tap away — because there is no room to inline it in a 3–4px pill, and an
  in-comparer label reveal would be new UI (out of scope, user-confirmed).

- **#40 Life List — remove the dead sticky-header CSS.** The default-mode `<thead>`
  carries `position:sticky; top:0` that is inert (the wrapper never scrolls
  vertically), so the header already scrolls away with the page on phones. Per the
  user's decision — a sticky header only wastes phone screen space and isn't
  wanted — this is resolved as a **cleanup**: remove the ineffective sticky
  declaration from the default (non-wideMode) path so the header intentionally
  scrolls away. `wideMode`'s own behavior (where the sticky is effective) is left
  exactly as-is. No scroll-model change, no behavior change on any surface.

## Why now
Deferred-behavior findings from the v0.5.55 mobile-prep audit, tracked on the
ROADMAP Horizon, addressed together ahead of the mobile launch. Each was deferred
because a naive fix adds content or changes scroll behavior; scoped here to the
minimal, convention-following version — and #40 further reduced to a cleanup once
the user decided against a phone sticky header.

## User-facing impact
- #26: new visible text in the Breeding Codes legend(s) — copy-adjacent, so
  docs/HELP.md, README.md, and website/ Breeding Codes copy get a look.
- #27: a small count number appears beside media icons on phones (≤640) only.
- #40: none — the header already scrolls away in default mode; this only removes
  dead CSS so the code matches the behavior.

## Decisions touched
None. No DECISIONS.md entry is reversed or modified. The work follows the existing
CLAUDE.md responsive + accessibility standing conventions (surface hover-only info
for touch; lift layout to a class; base-hide/≤640 reveal) rather than changing
them. #5 (comparer A/B side-cell labels, shipped in 081a2588) is preserved; the
#27 media-count reveal is independent of it.

## What done looks like
- Breeding Codes: a touch user can read what every present code means without
  hover, on both the matrix legend and the filter-pill legend; existing
  aria-labels intact.
- List Comparer: media counts are visible on a phone; the A/B tags from 081a2588
  are preserved; no in-comparer breeding-label reveal is added.
- Life List: the ineffective sticky-header CSS is gone from default mode; the
  header scrolls away as it already did; wideMode is byte-identical.
- Full suite + lint + tsc -b + build green; patch version bump (0.5.55 → 0.5.56,
  both files); CHANGELOG + docs where the #26 legend copy is user-visible.
