# Change Brief — A11y, Taxonomy and Screenshot Sweep

## What is changing

Four independent improvements bundled into one release, plus the closeout
records for a parallel build whose code is already on main.

1. **The three remaining 320px / 200% horizontal-scroll leaks** — Statistics
   60px, Checklists 42px, Calendar 29px. Each was measured in the browser
   during the v0.5.82 sweep and each has its own cause.
2. **The taxonomy batches that still send raw observation names only.** Seven
   `/taxonomy/codes` call sites never add the normalized parent name, so a
   species recorded only as a form ("Muscovy Duck (Domestic type)") resolves
   nowhere and silently loses its favicon and taxonomic sort on those rows.
3. **A rename bridge for stale exports** — an export written under an older
   eBird taxonomy revision resolves nowhere in the current species lookup.
4. **Regenerating the committed website screenshots** against the v1.0.3 raven
   header, with the two demo-tooling tidies that have been waiting for this
   touch: a fail-closed demo-dataset guard on `capture-appstore.mjs`, and
   moving the synthetic checklist IDs out of the plausibly-real range.

Screenshots run **last**, after the layout fixes land, so the set is
photographed once against the final UI.

## Why now

Direct user request, taking the whole Improve backlog in one pass. Two items
have a deadline of their own: the screenshots have been wrong since v1.0.3
replaced the header mark, so the brand change is invisible on the website and
in the README where people first meet the app; and the demo-tooling tidies are
both recorded as "at the next `gen-demo-data.mjs` / capture touch", which this
is. The scroll leaks are what forces `ACCESSIBILITY.md` and `docs/HELP.md` to
qualify claims they would otherwise make outright.

Riding along: `named-birds-top-locations`, the parallel build that shipped in
v1.0.3, has its code fully on main (verified: all five files present, working
tree clean against `origin/main`) but stops at `implementation.md` — no QA,
security, PR, or deployment record. Its closeout is a records-only task.

## User-facing impact

Yes, in three of the four. The three tabs stop leaking sideways scroll at the
narrowest width and largest text size, which will change how those clusters
lay out at that size (the precedent fixes traded height for fit). Rows that
carry only a form name regain their favicon and taxonomic sort position; no
count anywhere changes. A stale export keeps resolving instead of silently
degrading. Screenshots and the demo-tooling tidies are not shipped app code.

## Design pass

**Needed.** Three surfaces, three separate causes, each needing a call about
what gives at 320px / 200%: the Statistics cluster (60px), the Checklists
cluster (42px), and the Calendar cluster (29px, which the v0.5.81 filter-text
formula grew from 27px). The precedent fixes in this family were all Designer
calls with the trade recorded — v0.5.85 chose to wrap the tier legend and paid
in height; v0.5.86 released two nested flex floors behind phone-scoped hooks;
v0.5.82 accepted a visible two-line wrap on Breeding Codes at 1x. The same
judgment is needed here, and a visible layout change on a small phone should
not be a side effect of a fix.

Not in the design pass: the taxonomy work, the rename bridge, the screenshot
rerun, or the demo-tooling tidies — none changes how anything looks.

## Decisions touched

- **`The count-cluster leak` — 2026-08-09 (v0.5.82).** Its closing note names
  these exact three leaks as deliberately out of scope and separately tracked.
  This closes them; the entry is extended, not reversed.
- **`Mobile filter text size` — 2026-08-09 (v0.5.81).** Recorded that Calendar's
  pre-existing leak grew 27px → 29.5px from the intended text growth. That
  number is the starting measurement here.
- **`ACCESSIBILITY.md:77`** claims the offline surfaces "hold at 200% text scale
  without leaking horizontal page-scroll" — currently not true on three tabs.
  **`docs/HELP.md:588`** carries the softened counterpart ("a few dense spots
  can still scroll sideways a little"). Both go back to unqualified once the
  leaks close, and must move in the same change as the fix.
- **The v1.0.1 escapee/domestic-form fix** established the normalized-parent
  batch shape on Statistics. This applies the same shape to the remaining call
  sites; nothing about that decision changes.

## What done looks like

- No page horizontal scroll on Statistics, Checklists, or Calendar at 320px and
  200% in-app text scale, in both themes, measured in a real render.
- A species recorded only as a form name resolves its favicon and sorts
  taxonomically on every tab that shows one; counts unchanged everywhere.
- An export using an older revision's names still resolves; a current export is
  byte-identical in behavior.
- `ACCESSIBILITY.md` and `docs/HELP.md` state the unqualified claim.
- Website screenshots show the raven header; `capture-appstore.mjs` refuses to
  run against a non-demo backend; synthetic checklist IDs 404 cleanly.
- `pipeline/named-birds-top-locations/` carries its QA, security, PR and
  deployment records.
