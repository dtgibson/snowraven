## Frivolous Lists

### What this does
Adds a **Frivolous Lists** section at the bottom of the Statistics page — three self-completing collections computed entirely from the already-loaded eBird backup (no backend, no new providers, privacy unchanged):
- **Avian American** (22) and **California Dreamer** (7) — check off each "American …" / "California …" species the user has recorded, with a `recorded / total` count and a completion badge when the set is finished.
- **Rainbow Warrior** — for each rainbow color (red → violet), the earliest-first-seen bird whose name contains that color, shown with the first-sighting date + location and a link to that eBird checklist; an unfilled color shows a blank; a badge appears at 7/7.

### How to test
1. `cd frontend && npm run dev`
2. Open `http://localhost:5173`, go to **Statistics** (load an eBird backup in Settings if prompted).
3. Scroll to the very bottom — the **Frivolous Lists** section. Verify the counts and checkmarks, the completion badge on a finished list, the Rainbow rows (a name opens Species Detail; a date opens the eBird checklist), the empty-color blank, and the new "Frivolous Lists" chip in the section jump-nav.
4. Toggle dark mode — the rainbow swatches and badges stay legible.

### Notes for reviewer
- Pure logic in `lib/frivolousLists.ts` (14 vitest cases); presentation in `components/FrivolousListsSections.tsx`, mirroring `MediaStatsSections`. Wired as the final `<SectionCard>` in `BirdingStats.tsx` + appended to the jump-nav after Media.
- Color match is whole-word, case-insensitive (`/\b{color}\b/i`, non-global so `.test()` is stateless — the CLAUDE.md `lastIndex` rule). One bird may fill multiple colors (Violet-green Swallow → violet AND green); earliest-date ties break on lowest `submissionId` for deterministic tests.
- Computed from the **all-time** observation set (independent of the Statistics "include spuh" toggle); spuh/slash/" x " hybrids excluded from matching.
- Seven new `--sr-rainbow-*` swatch tokens added to **both** themes; checkmarks/badges reuse the existing `--sr-milestone-1-*` tokens (no new contrast risk).
- Unseen Avian American / California Dreamer birds show the eBird/BoW favicons but no Species Detail link — their codes come from adding the 29 hardcoded names to the existing `/taxonomy/codes` batch (resolved by common name, both transports).
- Rainbow Warrior assigns a **distinct** bird per color where possible (maximum bipartite matching), preferring earliest-first-seen; a bird fills two colors only when no alternative exists.
- Built and verified on `origin/main` `10dfe02` (0.5.35 released); no changes outside the feature — `nearbyLifers.ts` stays at your `7af29d5` fix.

### Verification
Lint clean · full vitest suite 925 passing (75 files; +14 new) · `tsc -b` + `vite build` green.
