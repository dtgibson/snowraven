## Life Lists (life-lists-tab)

### What this does

Adds a **Life Lists** tab directly after Checklists that lists every countable species in the eBird backup, newest first by the date it was first recorded, with that first sighting's position on the list, scientific name, eBird and Birds of the World links, date, time, checklist and place. Two off-by-default switches (Include Escapees, Include Exotics) put back the species the Statistics escapee check classified, and three media buttons (Photo, Audio, Video) turn the list into a photo, audio or video life list, or any combination, dated to the day each species first held every selected type. To support Include Exotics, the Statistics pass now publishes an exotic-only name list beside the escapee list it already published, in the same document and the same write, with no new request.

### How to test

1. `cd frontend && npm run build`, then `cd ../backend && .venv/bin/uvicorn main:app --port 1621` and open the app (it serves `frontend/dist`).
2. With an eBird backup saved, open **Life Lists** (directly after Checklists in the tab bar, the sidebar and the phone's More sheet). The newest species is at the top carrying the highest number; the count sentence above the list states the same number.
3. Click a species name: it opens on Species Detail. The small eBird and Birds of the World marks beside the name open those pages.
4. With no ML export saved, the three media buttons are dimmed and focusable, and the sentence under them says why. With an ML export saved, press **Photo**: the list narrows to species you have photographed, dated to your first photo, and renumbers. Press **Audio** too: the list narrows to species with both, dated to the later of the two firsts. Release both: the first-sighting list returns.
5. Open **Statistics** once with your API key so its escapee check runs, then return: the status line under the controls changes to the "can be shorter" sentence once every checklist has been checked, and **Include Escapees** / **Include Exotics** each add back exactly their species.
6. With more than 100 species, use **Show next 100** and **Show all**; keyboard focus stays on the button, then moves to the count sentence when the last rows appear.
7. Remove the eBird backup in Settings: the tab returns to the "eBird Backup Required" panel.

### Notes for reviewer

- **First commit is a byte-level repair:** `exoticProvenance.ts` held a literal U+0000, so git treated it as binary. Escaping it (behaviour-identical, with a source row that keeps the module free of literal control or non-ASCII characters outside comments) is its own commit, so the feature's diff to that file is a text diff.
- **Store change:** `exotic-provenance-v1` gains an optional `exoticNames: string[] | null` on the same key and version (`null` = never published, the safe direction: every species listed). `MAX_PUBLISHED_NAMES` is now 2,048 for both lists, so the worst-case document is what one list of 4,096 cost; `settingsRouteBudget.test.ts` rebuilds it with both lists through `sanitizeStore`. `publishClassifiedNames` replaces `publishExcludedNames` at its single call site. The clear registry row covers the field unchanged (`clearDerived.ts` and `cacheInventory.test.ts` are untouched).
- **Requests:** the tab makes exactly one `/taxonomy/codes` post per distinct roster (the Checklists-shaped batch, local on Tauri, the user's own server on web/Pi) and nothing else: no provenance request, no hotspot set, no third-party host. Codes feed `BirdName`'s marks only, never classification.
- **Scans over user-file text** are the ones schema section 7 declares (S1 to S8), hand loops with their own length gates; `lifeLists.test.ts` asserts the module holds no regex and none of the search primitives, comments stripped. The `security.md`, `bird-names.md` and `ui.md` `paths` gain the new files.
- **Deviations from the artifacts**, each argued in `decisions.md` D-14 to D-23: intergrades and domestic types fold into their parent under the shared countability rule (QA-10's example restated); the display order puts blank-time rows last per FR-28 (not the bare reverse the schema's prose suggests); the roster key is `JSON.stringify` rather than a newline join; dashes use `--sr-text-muted` rather than `--sr-text-disabled` (AA); the linearity guard's legs are 5k / 50k with the limit unchanged, and pass 3's limit is derived from S log S, after measurement showed the engine's live-set residual (D-19).
- **Measured cost** (D-20): at the 150k-row cap a load costs about 110 to 125 ms of main-thread CPU, inside the load effect; a control change re-runs only pass 3, under a millisecond.
- **Published copy is held:** nothing in `README.md`, `website/`, `appstore/`, `fastlane/` or `PRIVACY_POLICY.md` changed. The proposals are in `pipeline/life-lists-tab/held-copy.md`. `docs/HELP.md` gains a `## Life Lists` section after Checklists and names the tab in the Getting Started and Default Files lists.
- **Not verified here:** anything geometric (320px and 200% text, both engines, the stacked card, the focus ring offset). jsdom has no layout; that is the live look's job.
- No version bump and no `CHANGELOG.md` entry: those are the Deployer's.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
