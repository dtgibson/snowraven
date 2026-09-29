## Targets opens on lifers only (targets-lifers-default)

### What this does
The Targets tab now opens with only **Lifer** pressed; **Media** and **Breeding** start off and come back with their existing pills. The one code change is `DEFAULT_TOGGLES` in `frontend/src/lib/targets/targetsFilter.ts` (`media: false`, `breeding: false`; chips empty and threshold `'any'` unchanged). Filtering, badges, counts, sub-controls and empty states keep their current logic, and the in-app help says what the tab opens on.

### How to test
1. Open the Targets tab on a county with a species list loaded.
2. Lifer is pressed; Media and Breeding are not. The Photo/Audio/Video chips and the Any code / Confirmed segbar are not shown. The list holds lifer rows only and the summary reads "N targets · N lifers".
3. Press **Breeding**: the Any code / Confirmed segbar appears and the recorded species with no breeding code come back.
4. With an ML export in Settings, press **Media**: the three chips appear and the missing-media rows come back. With no export, Media stays `aria-disabled` with its reason, as before.
5. Relaunch (or reload): the tab is back on lifers only. Only the county is remembered.
6. Open Help, Targets, "The three kinds of target": the new sentence reads "The tab opens showing lifers only, with **Media** and **Breeding** off until you turn them on."

### Notes for reviewer
- **Reverses targets-tab FR-19** ("all on by default"). The shipped targets-tab pipeline files are untouched; the Chronicler logs the reversal.
- **No migration.** The toggles are plain `useState` and never pass through the storage seam, so a relaunch already reset them.
- **Tests.** `targetsFilter.test.ts`: the semantics rows (QA-20, QA-21, FR-20, QA-27) spread `DEFAULT_TOGGLES` and would have gone vacuous or red, so they now start from an explicit `ALL_ON` fixture. The old threshold-only default row became one row that pins the whole default and shows the default view is the lifer rows, with an all-on control on the same pool. `Targets.test.tsx`: a new first-open row (with the ML export loaded, so Media is off because of the default and not FR-20) checks the pressed states, that the chips and threshold groups are absent, that only the lifer row shows, and that pressing Media and Breeding brings back their chips, threshold and rows. The Species Detail, summary and two measuring-point rows press Breeding first. The all-off row now presses only Lifer. `targetsPublishedClaims.test.ts`: a new row holds the HELP sentence to `DEFAULT_TOGGLES`, with the control names taken from the pills' labels.
- **Mutation check.** Putting either `media` or `breeding` back to `true` fails all three new pins (filter, component, published claims). The file was restored and its hash checked.
- **Bundle.** The built CSS is byte-identical to HEAD (same content hash), so the new comments in files under `frontend/` added no Tailwind rules.
- **Published surfaces untouched.** README.md, website/, PRIVACY_POLICY.md and appstore/ describe the kinds of target, not what starts on, so nothing there became untrue. No version bump or CHANGELOG line here: the Spool bundle stamps once at the flush (brief: a "Changed" line at that stamp).
- **Known and accepted (brief):** the FR-24 "No lifer targets for you in {County}, across its N species." line is likelier now, because the tab opens on the most-birded county. This build adds no new hint copy for it.

## Seeing Targets opens on lifers only locally

1. Open a terminal in the project folder (`snowraven`).

2. Start the backend:
   `cd backend && .venv/bin/uvicorn main:app --reload --port 1620`

3. Open a second terminal in the project folder and start the app:
   `cd frontend && npm run dev`

4. In your browser, go to:
   http://localhost:5173

5. Click the **Targets** tab. Pick a county whose species list is loaded, or one you can load with your eBird key.

6. What to look for: **Lifer** is highlighted and **Media** and **Breeding** are not. There are no Photo/Audio/Video chips and no Any code / Confirmed buttons, and every row carries the Lifer badge. Press **Breeding** and the recorded species with no breeding code join the list, with the threshold buttons. Press **Media** (with an ML export in Settings) and the chips and missing-media rows appear. Reload the page and it opens on lifers only again.
