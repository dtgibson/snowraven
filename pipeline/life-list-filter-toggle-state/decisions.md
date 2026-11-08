# Decisions: life-list-filter-toggle-state (Engineer)

## D-1. Lower the hover rule's specificity with `:where()`, rather than raise the selected rules

The pill and segment hover rules now read `.sr-pill:where(:not(:disabled):not([aria-disabled="true"])):hover` and `.sr-segbar-btn:where(...):hover`, which are (0,2,0): one class plus `:hover`. The inert gates still apply; `:where()` only stops them counting.

Why this over the alternative (raising each selected-state rule to (0,4,0) or above):

- It is two selector edits instead of nine (the eight pill selected-state selectors the old hover outranked, listed by the guard when it is run against HEAD's stylesheet, and the segment's one).
- Raising `.sr-pill[aria-pressed="true"]` to (0,4,0) would also make it beat `.sr-pill:disabled` / `.sr-pill[aria-disabled="true"]` (0,2,0, declared after it), so a pressed pill that is also disabled would start showing the accent look instead of the disabled look. Lowering the hover changes nothing about that pair.
- It makes the recorded convention true as written. The control-style-registers design (v1.0.33) says the selected state wins "at equal specificity" through source order, copying `.sr-hotspot-mode-pill`, whose hover really is (0,2,0). The register added the inert gate as bare `:not()`s, and each `:not()` adds its argument's specificity, which is how the pair became (0,4,0) against (0,2,0). This fix reverses nothing in that decision.

`.sr-toggle`'s hover keeps its bare `:not()` selector (the brief scoped it to the gate only). It has no selected-state rule in the stylesheet: its on/off state is drawn by the track.

## D-2. What lowering the hover changes, both directions

A rule's reach is its selector, not the surface the bug was found on, so the competitors were enumerated over every rule in `globals.css` (any depth) whose rightmost compound can match a register button, with the co-classes those buttons carry in production (`sr-touch-target`, `sr-lfl-pill`, `sr-bc-filter-pill`).

**Where the hover now loses that it used to win** (a matching rule declaring a property the hover sets, at a specificity from (0,2,0) declared after, up to (0,4,0) declared before):

- Every pill and segment selected-state rule below (0,4,0): pressed, positive, negative, target, the four Breeding Codes tier rules, and the segment's pressed rule. This is the fix. (The tier-1 "Possible" cross-case is (0,4,0) and declared after, so its `color` already won; its tier-1 sibling's background and border now win too.)
- `.sr-segbar[aria-disabled="true"] .sr-segbar-btn` (0,3,0, `color`). Unreachable: the only segment group that is ever marked disabled (the Targets window group, `TargetsControls.tsx`) also marks each of its buttons `aria-disabled`, so the hover's inert gate already excludes them.
- `.sr-pill:disabled` / `[aria-disabled="true"]` (0,2,0, after). Unreachable for the same reason: the hover excludes inert controls.

Ruled out by reading the markup: `.sr-wx-seg button` and `.sr-map-layers-seg button` match by shape, but neither host contains a register button. Tailwind utilities are inside `@layer` and lose to unlayered rules whatever the specificity, before and after. An inline style beats both rules, before and after.

**Where the hover now wins that it used to lose:** nowhere. It only lost specificity, and the media gate only removes the rule where the primary pointer cannot hover.

The built bundle confirms the scope: a rule-level diff of `dist/assets/index-*.css` against a HEAD build differs by exactly the three hover rules (each now under `@media (hover:hover)`, two now with `:where()`), 1,817 rules either side, nothing inside any `@layer` changed, and `vendor-maplibre-*.css` is byte-identical.

## D-3. `(hover: hover)`, as the brief chose, and what it leaves

`(hover: hover)` asks about the PRIMARY pointer. Phones and tablets report `(hover: none)`, measured in both Playwright engines with `hasTouch`; a desktop reports `(hover: hover)`, measured too. Two residuals, neither a regression:

- A device whose primary pointer is touch but which has a mouse or trackpad attached gets no hover feedback on these controls. That is the cost of the gate the brief chose, and the controls stay fully readable by their state colors and weight.
- A device whose primary pointer is a mouse but which also has a touch screen (a touch laptop) still applies hover after a tap. There, a tap that turns a pill ON is fixed by D-1 (selected now beats hover); a tap that turns one OFF still shows the hover look until the next tap. Not measured on hardware (device boundary).

## D-4. The specificity helper moved and was corrected

The brief asked to reuse `specificity()` from `lib/mapFabCascade.test.ts`. Read closely, it scored a CLASS as a type selector (`.sr-pill` came out (0,0,1), the old hover (0,3,1)), because the class case fell through to the final branch. A test file cannot be imported by another without registering its tests twice, so the four selector functions moved to `frontend/src/test/cssSpecificity.ts` (beside `cpuTiming.ts` and the other shared test helpers), with one added line that scores a class as (0,1,0).

- The move was checked mechanically: the four functions in the helper equal HEAD's four, byte for byte, apart from that one line.
- `mapFabCascade.test.ts` stays green with the correction (8 of 8, including its built-bundle half and its check that every excused competitor is still needed), so none of its verdicts moved: every pair it compares carries the same number of classes.
- The new guard's first row pins the corrected scores against literal tuples, and putting the old bug back turns that row red (and the restore row, whose message would print (0,3,1)).

The four other local specificity copies in the suite (`dateRangeFieldsCss`, `targetsSortSelectCss`, `TabNav`, `AlertsInboxEntry`) score a class correctly and were left alone.

## D-5. Two out-of-scope findings, recorded and not fixed

Both are single-surface rules the brief put out of scope. Read off the stylesheet; neither was measured in a browser here.

- `.sr-palette-row:hover` is (0,2,0) and `.sr-palette-row--active` is (0,1,0), so the command palette's highlighted row takes the hover fill under the mouse, and the comment above it ("This rule follows the hover rule at equal specificity, so it wins") is false in the same way the register's was. The 2px accent outline still marks the row.
- `.sr-hotspot-kind-chip:hover` (Map Explorer) has no `(hover: hover)` gate, so on a touch screen a tapped chip keeps the hover fill until the next tap.

The held What's New was worded so it does not claim either control (`held-copy.md`).

## D-6. The probe drives the real Life Lists tab, plus a fixture for the other registers

The Life Lists pills are inert without a readable ML export, so the probe serves the built `frontend/dist` through the verify gate's own `serveDist` with a stub backend (a small eBird export and ML export, no key stored, every non-loopback request aborted). The registers Life Lists does not draw (a segment group, the negative, target and two tier pills) are measured on a small fixture injected into that same live page, so the same built stylesheet paints them in the same engine; the output labels them as a fixture.

It lives in `pipeline/life-list-filter-toggle-state/evidence/`, not in `website/tools/verify/`, because the brief asked for evidence, not a new CI gate. Promoting it is a possible follow-up.

One reading worth keeping: on the pre-fix build, Chromium did NOT keep `:hover` on a real Life Lists pill after a tap (the tap re-renders the list), while it did keep it on the static fixture pills; WebKit kept it everywhere. So a Chromium-only touch check of the real tab would have read the shipped defect as absent. iOS and iPadOS run WebKit.

## D-7. No Help, accessibility or version change

`docs/HELP.md` and `ACCESSIBILITY.md` describe no hover look for these controls, so neither changes. The global `:focus-visible` ring is untouched; the probe shows it after a real Tab in both engines, both contexts and both themes (16 of 16). No version bump: the ship step does the six-file set after the user approves the held copy.

# Decisions: life-list-filter-toggle-state (Deployer, the 1.0.65 ship)

## D-8. 1.0.65 shipped over a timing-only Pipeline red, under D-17

`DECISIONS.md` v1.0.64 (D-17) shipped 1.0.64 with Pipeline red on `lifeListsLinearity.test.ts` alone, a CPU-time ratio on GitHub's shared runners, with the reversal "a failure in a test the release touches, or any non-timing failure". 1.0.65 meets the same condition and ships under the same acceptance.

- **The evidence.** Pipeline `42439739481` on `4528042c` (the merge that carried the release to `main`) failed twice on that row alone: "pass 1 (first sightings), every row its own species", quotient 21.55 on attempt 1 and 22.35 on the one allowed re-run, against a bound of 20 where linear reads about 10. Backend, lint and typecheck were green both times. The next push, `21e4a9e1` (the iOS stamp and part two B's record), started Pipeline `42442083898`, which failed on the same row again (20.01 against 20, `lifeListsLinearity.test.ts:126`, its only failing assertion), with Backend green.
- **Why it does not reverse.** This release changes `globals.css`, `controlRegisters.test.ts`, `ToggleSwitch.test.tsx`, `mapFabCascade.test.ts` and the new `test/cssSpecificity.ts`. None of them is `lib/lifeLists.ts` or anything the ratio measures, and no failure was anything but that timing row.
- **What stood in for the steps CI skipped after the failed test step**, on `4528042c`: `lifeListsLinearity.test.ts` alone at `--maxWorkers=1`, 8 of 8; `npm run build` exit 0; the real-engine verification gate (`website/tools`, Chromium and WebKit), "8/8 harnesses green", 239 PASS and no FAIL. Windows Build, Android Build and Pages were green.
- **The reversal condition is unchanged:** a failure in a test the release touches, or any non-timing failure. The test's CI headroom stays the inbox's `f79a03a9`, not this release's question.

## D-9. The iPhone check of the exact uploaded build: passed, in the user's words

The user checked TestFlight build 1.0.65 (1.0.65.1), build id `e1f3f6f9-fea2-45f7-99d6-fa1126ab8713`, on their own iPhone, with the steps from part two B (install from TestFlight; open Life Lists; tap Photo, Audio and Video on and off; tap Include Escapees). Their reported result, the option they chose, in their words: **"Yes, the buttons look right."** It was given in the orchestrator's session before 04:00 UTC on 2026-11-08 and relayed in this invocation's brief. No agent touched the device (CLAUDE.md, Device boundary). This closes the iPhone criterion the Tester left Partial; Android stays Partial on emulator evidence by the standing decision.

## D-10. The App Store: 1.0.64 rolled up into 1.0.65 on its record

**Decision: roll up, as the user approved at the production sign-off.** Their plan: "if 1.0.64 is still waiting for review at that point, I move its record to 1.0.65 with the new build (one review carries both); if it is already in review, 1.0.65 waits on TestFlight until 1.0.64 is approved, then gets its own record."

- **The reading that decided it:** at 04:00:51 UTC on 2026-11-08, record `ab6360bc-24b3-4816-bf84-88967df06507` was 1.0.64 `WAITING_FOR_REVIEW` and submission `740963c6-7ca7-495b-96d2-d6fd769876b3` was `WAITING_FOR_REVIEW`, not `IN_REVIEW`; build 1.0.65.1 was `VALID`; no 1.0.65 record existed. So the first branch applied.
- **What was done** (metadata key, every request and status in `evidence/ship/asc-rollup-1.0.65.txt`): withdraw (`DELETE /v1/appStoreVersionSubmissions/ab6360bc...`, 204; the record `DEVELOPER_REJECTED` within six seconds, the old submission `CANCELING`, then `COMPLETE`); retarget the same record (`versionString` 1.0.65, 200); repoint it at build `e1f3f6f9` (204); one localization `PATCH` of the What's New (200); the listing and screenshot read-backs; then `POST /v1/reviewSubmissions` (201), `POST /v1/reviewSubmissionItems` (201) and `submitted: true` (200). **New submission `33624506-edfa-4d5c-9cc7-806b0d3a7866`, `WAITING_FOR_REVIEW`, submitted 2026-11-08 04:01:55 UTC; the record 1.0.65 `WAITING_FOR_REVIEW`, `AFTER_APPROVAL`, no phased release.**
- **Why the What's New carries both approved texts, not the 1.0.65 text alone.** The brief for this step named the 1.0.65 text. The record already held 1.0.64's approved text (217 characters, from `pipeline/exotic-provenance-reuse/held/whats-new.txt`), and the house rollup form keeps the rolled-up version's approved text first, a blank line, then the new one (1.0.47, 1.0.50, 1.0.55, 1.0.59, 1.0.63), because store users on 1.0.63 never received 1.0.64's note. This run's own plan named that form too (part one, the App Store options; part two B, "What remains"). Both texts are approved verbatim, so no unapproved word was written: 591 characters, read back byte for byte. **Reversal:** if the user wants the 1.0.65 text alone, the change is a withdraw (cheap while `WAITING_FOR_REVIEW`), one localization `PATCH` and a resubmit.
- **The read-back:** every listing field against `appstore/LISTING.md` and `appstore/REVIEW_NOTES.md`, `READBACK 1.0.65: ALL SAME`, after the write and again after submitting; the promotional text carried on the retargeted record (137 characters), so nothing needed restoring; `asc-screens.mjs readback` ALL MATCH, 18 of 18. The deployment record's part two C has the field table.
- **The ledger:** the rollup joins the list in `RELEASE_LEDGER.md`'s rule paragraph, the 1.0.64 App Store entry carries a dated correction in place, and the 1.0.65 entries name both versions, the record, both submissions and both builds.
