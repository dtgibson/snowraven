## Help docs refresh (help-docs-refresh)

### What this does
Brings `docs/HELP.md` (the in-app Help and the GitHub-hosted documentation) up to date with what has shipped through 1.0.45: iPhone and iPad are named wherever Help lists where SnowRaven runs or where files and keys live, drifted labels and behavior are corrected, controls Help never covered are documented, release-note phrasing becomes present behavior, British spellings go, and the tab sections now follow the app's default tab order. No app behavior, UI text or layout changes. Drift found in `PRIVACY_POLICY.md`, `website/privacy.html` and `ACCESSIBILITY.md` is in a held patch (`pipeline/help-docs-refresh/held-patch.md` and `held-patch.diff`) and is not applied.

### How to test
1. `cd frontend && npm run dev`, open http://localhost:5173, click **Help** in the footer.
2. The sidebar lists the tabs in `DEFAULT_TAB_ORDER` and has new **Widgets** and **Alerts** sub-entries; each jumps to its section.
3. Read Getting Started, Default Files, Settings (new Help & Documentation section, renamed Troubleshooting heading) and Using SnowRaven offline.
4. `npx vitest run src/lib/helpToc.test.ts src/lib/*PublishedClaims*.test.ts src/lib/widgets/widgetCopy.test.ts`

### What changed, item by item (audit sections A to E)
Every item in A, B, C, D, E1, E2 and E3 is done. None is won't-fix.

- **A1** intro names the Mac, Windows, iPhone and iPad apps and the self-hosted Pi, in the README's approved form.
- **A2** (a) welcome screen and where Help opens; (b) eBird key stated as the property ("anything that asks eBird a question") with examples, and the OpenWeather step swept the same way; (c) the backup list is complete over the tabs, in `DEFAULT_TAB_ORDER`, plus the Weather tab's backlog; (d) the ML export as the property with examples. Swept with it: the `### eBird API key` paragraph, which had the same incomplete list.
- **A3** "used by" lists: the backup is a complete list over every tab (the tab set is closed and checkable) plus Search, widgets and Alerts named as also reading it; the ML export is the property with examples, because its consumers cross sections and the audit's own list missed one (the Checklists tab's photo, audio and video filters, now included).
- **A4** where files and keys are stored (Default Files intro, Settings Default Files, and Settings API Keys, the last swept with it); the **Import file…** / **Import new…** labels and the file picker; the optional sentence on saving the eBird download to Files on a phone.
- **A5** auto-copy is "on every platform" (verified: `App.tsx` calls `copyText` unconditionally, which uses the clipboard plugin registered for all platforms with the shared capability).
- **A6** iPhone and iPad location fix (string from `lib/location.ts`).
- **A7** Troubleshooting on iPhone and iPad, **Rebuild caches** and the close-and-reopen step; heading renamed to "Troubleshooting (Mac, Windows, iPhone and iPad)" (no internal link used the old anchor).
- **B1** **Install update and restart**, restarts by itself. **B2** **Find Hotspots**, the view's Find button, and **Find Nearby Lifers** named in its section. **B3** **Show subspecies** (off by default) and **Show non-bird** documented (mechanism verified in `LifeList.tsx`: ML items whose name is not in the backup). **B4** Target Species picker, **Find Recent Sightings**, **Filter by Type** chips (multi-select, narrows to species missing every selected type). **B5** Alerts inbox destination in Search (palette guard's visible-tab sentence kept). **B6** Offline section swept whole: List Comparer's Checklists mode, the three Map Explorer searches, escapee check and Projects, widgets and Alerts, Plan replay, and (found in the sweep) Macaulay Library players. **B7** default sort as `targetsSort.ts` implements it, plus "a sort you choose stays while it can work". **B8** bar-chart file on web/Pi is on the server (Targets and Settings). **B9** live counts shared across devices with iCloud Sync. **B10** `### Help & Documentation` in the app's position. **B11** Default Location also anchors Targets and Alerts' Fixed place. **B12** rewritten with the house phrasing "per-session, resetting on relaunch". **B13** Plan pre-fills "Your location".
- **C1 to C9** rewritten as present behavior (C4 keeps "reads ... back" and "checklist comment"; C6 and C7 removed; C8 keeps the fact).
- **D** centre, greyed, greys, grey, metre fixed; also "labelled" and "a fortnight" in Named Birds, found by a wider spelling scan.
- **E1** sections moved byte for byte (verified: same byte count and same multiset of lines before and after the move), TOC reordered, directional cross-references swept (none crossed a moved section). **E2** Widgets and Alerts TOC sub-entries. **E3** the TOC comment states no count.
- **F1 and F2 untouched.** The three iCloud Sync paragraphs plus three lines of context either side are byte-identical to HEAD; the nearest edit is the Help & Documentation insertion five lines below. A read-only three-way merge of `HELP.md` with `weft-spool/20261002-160902` (`git merge-file`) is clean and carries the bundle's "Turning it off" sentence. F2's paragraph is byte-identical (it moved with Map Explorer). The bundle touches none of the other files this change edits.
- **G1 to G4** out of scope, untouched (the SnowRaven Mini sentence is left as is).

### Guards touched
- `frontend/src/lib/helpToc.test.ts`: four new rows (tab sections and TOC in `DEFAULT_TAB_ORDER` via `TAB_LABELS`; Widgets sub-entry; Alerts sub-entry; the Settings walkthrough follows the app's section order), and the Bar-chart files row follows the renamed Troubleshooting heading. Mutation-checked: two sections swapped in HELP alone, two TOC entries swapped alone, both swapped together (only the new order row goes red), each new TOC entry removed, Help & Documentation removed, two Settings headings swapped: all red.
- `frontend/src/lib/targetsPublishedClaims.test.ts`: the "Everywhere else the file stays on this device" assertion now pins the new web/Pi sentence and the scoped "Everywhere else" sentence, plus the web storage seam's POST to the server's bar-chart route. Restoring the old wording goes red.
- `frontend/src/lib/widgetsPublishedClaims.test.ts` and `frontend/src/lib/widgets/widgetCopy.test.ts`: their "Widgets section" bound was `## Multimedia`, which after the reorder would have widened the scan over three other tabs; both now end at the next `##`.
- `frontend/src/components/HelpDocs.tsx`: TOC order, two sub-entries, count-free comment.

### Test results
- Help-related suites (HelpDocs, HelpDocsHostileContent, helpToc, helpLinks, helpContentWidthCss, every `*PublishedClaims*`, settingsSectionOrder, exoticCrossTabSentence, weatherStats, widgetCopy, privacyPageParity, tabOrderCoverage): 22 files, 429 tests passed.
- Full frontend suite: 430 files passed, 5 skipped; 9,145 tests passed, 7 skipped; 0 failed (load average about 15 from other sessions, no orphaned processes).
- `npm run typecheck`, `eslint` on the changed files, and `npm run build`: all clean.
- Built CSS is byte-identical to HEAD (same file name and sha256), checked because Tailwind scans test files under `frontend/`; a second HEAD build was the determinism control.
- Register greps on `docs/HELP.md`: no U+2014, and no centre, grey, metre, colour, "Fetch hotspots" or "Merge subspecies".

### Held patch (not applied)
`pipeline/help-docs-refresh/held-patch.md` holds H-P1 to H-P3 and H-A1 to H-A5 as whole before and after paragraphs, with the matching `website/privacy.html` edits and an effective-date move, and lists the audit's judgment calls (plus one more, the privacy page's "On your device only" summary band) as optional extras. `held-patch.diff` applies cleanly with `git apply` from the repo root. With it applied: typecheck and eslint clean, all published-claims suites, parity and tab-order suites green, built CSS unchanged; its new guard rows (new file `frontend/src/lib/statementsPublishedClaims.test.ts`, and rows in `icloudBarChartPublishedClaims.test.ts`) went red under twelve mutations. The guard rows live in files this change does not otherwise touch, so the patch could be captured and the files restored with `git checkout` without disturbing the Help work. `git status` shows none of those files modified.

### Notes for reviewer
- Not bumped and no `CHANGELOG.md` edit, per the run's direction; the owed line is drafted in `pipeline/help-docs-refresh/changelog-line.md`.
- Found while verifying, outside this run's scope: on web and Pi the Settings Bar-chart files line reads "Saved for N counties on this device" (`barChartsSavedText` with `hereWord(null)`), though those files are on the server. In-app copy, so not touched here; worth an idea-inbox entry beside G1.
- Left as is, judgment: the Widgets "Settings." paragraph says "a widget you placed before this setting existed stays on it". It is migration phrasing, but it shipped one day ago (1.0.44) and is pinned in part by `widgetsPublishedClaims.test.ts`; it can go in a later pass.
- Left as is: HELP still says "kept on this device" for derived answers in a few places (Projects, live counts) where a web/Pi install keeps them on the server. That wording gives no wrong instruction, unlike the bar-chart sentence B8 fixed, so it was not widened into this run.
- The A3 accessibility rewrite in the held patch says the alert regions "are one shared component, and it has been verified against the rendered accessibility tree": the real-browser check on record predates Targets, which uses the same component. The held patch says so to the user.

### Revision after the Auditor (security-report.md)
- **L1:** Settings, API Keys no longer says keys are "saved securely" (on the Mac and Windows the key file is plain JSON under the user's account). It now says keys are saved where you run SnowRaven and are never sent to the developer. No other HELP sentence called key storage secure; no guard pinned the old wording.
- **I7:** Settings, Default Files now states the property (everything worked out from the backup goes with it) and gives the stores as examples, adding the Targets day answers, the widgets' species list and the Alerts position. The existing clear-registry row in `targetsPublishedClaims.test.ts` now also holds this sentence to `clearDerived.ts` and to the Alerts purge clearing the saved position; dropping the Alerts clause goes red. F1 and its context lines are untouched.
- **Held patch:** P2 now says Plan reads the location when you press the Plan button with no place chosen, and sends nothing until one of the form's two buttons is pressed. A second P2 pair fixes the iOS prompt sentence (I6), mirrored on the web page with its own guard row. Extras 4 and 8 are reworded, and the header says the effective date is set on the day the patch is applied. The new rows go red when the I6 wording is reverted on the page alone, when the "nothing is sent" clause is deleted, and when P2 goes back to "opening the form".

🤖 Generated with [Claude Code](https://claude.com/claude-code)
