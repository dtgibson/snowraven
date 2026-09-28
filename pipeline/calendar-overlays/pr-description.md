## Calendar overlays

### What this does

Adds two optional overlays to the Calendar tab. **Media** turns each day that has Macaulay Library catalog numbers into a tile of per-format counts (photo, audio, video, or one plain count without the ML export), and **Breeding** lists the eBird breeding codes recorded that day, strongest first, each with a category circle (solid Confirmed, half Probable, open Possible) and how many species carried it. A third control, **Every code / By category**, chooses how breeding rows are drawn. All three are off / Every code by default, persist through the storage seam, and enrich the legend, the day popup and each day's accessible name only while an overlay is on; with both off the Calendar's markup is byte-identical to before, except that every data day's accessible name now names its metric ("12 countable species").

### How to test

1. Open the Calendar tab with an eBird backup stored. Both switches under **Overlays** (end of the controls, beside Count all forms) read off; the grid is unchanged.
2. Turn on **Media**: days with ML catalog numbers show media rows under the count; the legend adds a MEDIA key. With an ML export stored, rows split by format; without it, one frame row with the total.
3. Turn on **Breeding**: coded days show code rows, strongest first, with "+N" past the cap. The **Every code / By category** control (dimmed while Breeding is off) switches to one row per category.
4. Open a busy day: the popup header sums up media and every code; each checklist row shows its own media and a tier-tinted chip per code.
5. Switch to **Large**: thumbnails show a corner frame (media) and a category circle (breeding) where the day number shows.
6. Try **Use Textures**, dark theme, a species filter, **All years**, and a phone width or 200% text (the tile switches to its condensed form and grows taller; no page scroll).
7. Reload: the switches and the codes choice are remembered. Turn both off: the grid is exactly as before.

### Notes for reviewer

- **Step 0 was done first:** `frontend/src/components/calendarOverlaysOff.fixture.json` was captured from the unedited base a9c9042 (8 scenarios: metrics, forms, textures, Large, All years, a species filter, popups), before any source file changed. It stores repeated cells once as `{{p:N}}` parts (174 KB). `calendarOverlaysOff.test.tsx` asserts byte-identity for a fresh mount AND after an on-then-off round trip; see decisions.md E5-01 for why the day cell varies values rather than keys.
- **Pure derivation:** `lib/calendar.ts` gains the overlay facts inside the one existing pass (after the species-filter `continue`, outside `if (countable)`), with lazily allocated Sets/Maps (E5-02 has the linearity figures). `lib/calendarOverlays.ts` (React-, lucide- and storage-free) owns the settings key, validation, the seven-key `OVERLAY_MARK_SPECS`, `tileRows`, `codeText`, `mediaFormatPhrases` and `dayNameSuffix`. `lib/useCalendarOverlays.ts` hydrates once and writes the whole three-field value on each change through a serialized chain.
- **`breedingCodes.ts` / `observationMedia.ts`:** additive exports; `resolveApiBreedingCode`, `strongerBreeding` and `observationMediaFormats` are refactored onto them with their existing tests unedited and green.
- **ML export** is read only while Media is on (and re-read on a files-epoch bump); a missing or non-matching export is plain counts, never an error.
- **Engine difference, recorded not fixed:** at a 390px viewport the tile's rich/condensed choice lands within a sub-pixel band where WebKit picks condensed and Chromium rich (decisions.md E5-03, with the reversal condition and the exact fix).
- **QA-48** classifies P as Possible; the table has it Probable, and the build follows the table (E5-04). **FR-25** is followed over the mockup for unknown ids in the popup (E5-05).
- **Two other suites edited deliberately:** `controlRegisters.test.ts` (paired labels 24 to 25 for the new OVERLAYS label) and `exoticRuleSurfaces.test.ts` (its cast fixture now carries the parser's always-set fields).
- **Docs:** `docs/HELP.md` Calendar section updated (a new "Overlays: media and breeding" subsection and one popup sentence), guarded by the new `calendarOverlaysPublishedClaims.test.ts`. README and website are untouched; one proposed sentence is in `pipeline/calendar-overlays/copy-proposal.md` for approval. `ROADMAP.md`'s "Name the metric in the Calendar's day accessible name" is removed (folded in as FR-28). Rule `paths` extended: `security.md` (calendar.ts, calendarOverlays*.ts, observationMedia*.ts), `testing.md` (the fixture), `ui.md` (calendarOverlays*.ts).
- **No version bump, CHANGELOG, tauri.conf.json or website pill change** in this build: another build on this project ships first, so the Deployer bumps at ship time after reconciling.
- **Verification:** typecheck, lint, full vitest, `npm run build` and the dist-reading `entryChunk.test.ts` green; a real-engine probe (Chromium and WebKit, 90 checks: page scroll off vs on at 320/390/820/1280 px and 100%/200%, the rich/condensed rule, fact-row ink inside the cell, count first in its own register, the Large-view floor) passed; 18 of 18 targeted mutations went red with the restore verified by hash.

### QA retry 1 (F1, F2)

- **F1 (WebKit, tiles too short after a text-size change):** WebKit sized grid rows from a stale flex-wrap line count when the text scale changed under a laid-out grid. Condensed rows no longer wrap; a container query on the cell (`max-width: 1.7em`, set from measured text) decides whether the glyph sits beside or over its text, and the stacked form is block layout (a column flex kept stale item widths in WebKit). decisions.md E5-07, E5-08.
- **F2 (unknown codes of 3+ characters overflowing):** the tile has its own bound, `tileCodeText` (an unknown code longer than two code points shows its first and an ellipsis); the popup and the accessible name keep `codeText`. Fact blocks span the cell's border box and clip with `overflow-x: clip`; the rich rows keep their designed inset as padding. In textures mode a block's backing now reaches the cell's sides. E5-09.
- Width-band sweeps in Chromium and WebKit (Tester's `vsweep.mjs` and a reverse-order sweep, 100 to 200% text, both codes modes, textures): 0 rows below a tile, 0 blocks past a side, 0 page scroll added. New guard `lib/calendarOverlaysCss.test.ts`. E5-10.

### Design revision D4-11 ("By category" names the categories)

- Under "By category" the tile shows **Conf / Prob / Poss** with each category's circle and species count, never a code; the compact tile shows each category's circle and count; the legend keys each short form to its word. Popup, accessible name, persistence and the control are unchanged. prd.md and schema.md amended at source ("amended per D4-11"); HELP.md updated.
- A short label is wider than a code, so a By-category tile turns compact at a width set by its widest count's digits (`categoryCountDigits` plus one measured container query per digit length, 2.6 / 3 / 3.4em). Without it "Conf 26" ran into its count by up to 7.5px. Every code tiles keep the approved 2.4em. decisions.md E5-12.
- Sweeps under By category in Chromium and WebKit at 100 to 200% text, both orders: 0 collisions, 0 rows below a tile, 0 blocks past a side, 0 page scroll added.
