# Run decisions — mobile-chart-rotation-tip

- **Lane:** Improve with a design pass (user chose Improve at the fork after
  the boundary was surfaced; user asked to see the design before build).
- **Design:** quiet, accent-free note (green = actionable; this informs).
  Exact copy and tokens in `design-refinement.md`. Inter/system-ui face is the
  established design-system deviation from the doctrine's display-face rule
  (design-lint `banned-font` warn accepted, logged here).
- **Placement (build):** Statistics renders the tip above the Life List Totals
  card (the tab's first chart lives there); Species Detail renders it directly
  above the graph area, gated on `hasGraphData` per the spec's "renders only
  where the graphs do." On Species Detail the Graph Options card sits BELOW
  the tip so the options stay adjacent to their graphs.
- **Persistence shape:** one `chartTipDismissed` setting holding a per-page
  map (`statistics` / `species-detail`), merge-written on dismiss so the two
  pages can never clobber each other; corrupt values degrade to
  never-dismissed rather than throwing.
- **Website:** version pill/footer bumped in lockstep (required); no site
  feature-copy change — the tip is a hint on two tabs, not a capability the
  showcase describes. Deliberate, for the Chronicler to ratify.

## Escapee-fix decisions (scope amendment)

- **Root cause, proven live:** the species-only `/taxonomy/codes` maps (both
  transports, identical since 0.5.14) cannot resolve a "(Domestic type)" raw
  name, so a species recorded ONLY as such a form never entered the escapee
  cover index — classified 'unknown', silently counted, "zero escapees found."
  Verified against the running backend: the codes response resolves none of the
  three; the checklist wire data carries the X tags correctly; the poisoned
  store had both escapee checklists in its ledger and no records for the three
  species.
- **Fix at the consumer, not the route:** the batch request gains each name's
  normalized parent (BirdingStats), keeping the twins' species-only
  `codes` contract byte-identical. This matches the media-link
  normalize-first precedent.
- **Heal at the chokepoint with explicit intent:** `carriersNeedingRefetch`
  (pure, exoticProvenance.ts) names the desync — a fresh ledger entry standing
  for a recordless cover species — and the controller passes
  `{ refetch: true }` through `dedupedFetchChecklist`, whose fresh-ledger
  short-circuit is otherwise the second enforcement point that would refuse
  the wave's pick. One refetch per stale carrier; the merge then records every
  admissible row and the store is permanently right.
- **Red-first evidence:** with the three fix-bearing sources stashed, exactly
  the two new repair tests fail (batch names; refetch-and-exclude) and the
  stays-green fresh-skip case stays green. Full suite 3029 green after.
- **Live end-to-end:** against the real backend + real export + real eBird key,
  one Statistics visit took the store from excludedNames [] / 261 records to
  ["Graylag Goose","Muscovy Duck","Swan Goose"] / 267 records, ledger 76 → 79,
  UI reading "3 of your species are eBird escapees."
- **For the Chronicler / roadmap:** eBird's 2027 revision renamed species
  ("Yellow Warbler" → "Northern Yellow Warbler"); an export written under the
  OLD name misses byCom entirely (no favicons, invisible to the cover). The
  normalized-parent batch fix does not cover renames; track as its own item.
  Also note `exoticProvenance.ts` remains git-binary (NUL separator); this
  change was verified by manual text diff (pure append).
