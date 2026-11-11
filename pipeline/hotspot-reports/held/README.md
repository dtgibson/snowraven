# Held copy for the Hotspot Reports release

Everything in this folder is HELD. None of it is written to a published file until the user has read the new language and said yes (CLAUDE.md, "Published copy needs the user's approval first"; `.claude/rules/docs-and-website.md`). `docs/HELP.md` and in-app text are not here: they are written directly in the build.

| Held item | Published file(s) it would change | State |
|---|---|---|
| `readme-and-website.md`: the one-sentence proposal for the tab's section, with the exact BEFORE and AFTER for each file, the website row's figure, icon and alt text, and the row flips below it | `README.md`; `website/index.html` | Held for the yes |
| `appstore.md`: the listing bullet and the recorded description length, the What's New, the screenshot caption and the record's screenshot table | `appstore/LISTING.md`; the App Store description, What's New and screenshot captions in App Store Connect | Held for the yes |
| `fastlane-changelog.md`: the F-Droid "What's new" text | `fastlane/metadata/android/en-US/changelogs/10000711.txt`, `10000712.txt`, `10000714.txt` (names assume 1.0.71; the Deployer confirms) | Held for the yes |
| `changelog-entry.md`: a CHANGELOG entry draft for the Deployer | `CHANGELOG.md` (written at the bump) | Draft |
| `privacy-and-accessibility-read.md`: the recorded read of both statements against the tab, sentence by sentence; nothing is made false, two optional additions are offered | `PRIVACY_POLICY.md` and `website/privacy.html`, `ACCESSIBILITY.md`, only if an offered addition is taken | Read recorded; no change required |
| `website-tools.patch`: the website/tools changes (the demo generator's weather blocks as a pure `buildDemoData()`, its vitest row `frontend/src/lib/hotspotReportsDemoData.test.ts`, the capture jobs for the website and both App Store families, and the `process-img.mjs` row for the new frame); applies cleanly to HEAD | `website/tools/` (published by the Pages deploy) and the screenshot sets it regenerates | Held for the orchestrator's confirmation |
| `verify-hotspot-reports.mjs`: the real-engine harness for the More sheet and the two container thresholds (schema 10.3 and 13.4), hermetic (served dist, stubbed backend), both engines, a declared denominator and an `--expect-broken` leg | `website/tools/verify/verify-hotspot-reports.mjs`, plus one `ORDER` entry and one `BUDGET_MS` entry in `website/tools/verify/run.mjs` (see below) | Held for the yes on `website/` |
| Regenerated `website/demo/*.csv` and every screenshot set (website and App Store, each image decided per device against its committed frame) | `website/demo/`, `website/assets/shots/`, `appstore/screenshots/` | The Deployer's, after the yes, from the patched generator and capture jobs |

## The one sentence (README, website and listing)

> Your own record at any one place you have birded, an eBird hotspot or one of your personal locations: your life list there, a map, your checklists by protocol, and the weather on your visits from the weather blocks in your checklist comments.

## How the held copy is guarded and applied

- Every proposal and every BEFORE/AFTER pair is a fenced block with four backticks and an info string (`before|after|proposal <surface> [n]`), so it can be read by a test and applied by a script. Every BEFORE block was cut verbatim from the published file by script and occurs exactly once in it.
- `frontend/src/lib/hotspotReportsSurfacesPublishedClaims.test.ts` reads those blocks. While its `APPLIED` constant is false it asserts the published files carry no Hotspot Reports copy yet, that each BEFORE applies cleanly, and, on the pairs applied in memory, every structural check (position between the tab's neighbours in `DEFAULT_TAB_ORDER`, the same sentence on the three files, the website rows still alternating, the listing's recorded length, the register rules for every proposal).
- On the yes: edit any block the user changed, apply each pair in order (`readme 1`; `website 1` to `4`; `listing 1` to `3`, dropping `listing 3` for a set that does not take the new frame), write the three F-Droid files at the bump, set `APPLIED = true` in the suite, and run it with the full suite. The website figure needs the capture job in `website-tools.patch` and a `hotspot-reports-light.png` to `hotspot-reports.webp` row in `website/tools/process-img.mjs`, and its alt text is re-read against the captured frame before the yes.

## Landing `verify-hotspot-reports.mjs`

Copy it to `website/tools/verify/`, add `'verify-hotspot-reports.mjs'` to `ORDER` in `website/tools/verify/run.mjs` (after `verify-plan-readout.mjs`, as the heaviest), and give it its own budget in `BUDGET_MS` (it runs two engines through the More-sheet legs, three text scales of fit sweeps and 344 window configurations; its measured time on the dev Mac is recorded in `pipeline/hotspot-reports/decisions.md` D-18, and the budget follows the house 4x-or-more rule written beside the plan harnesses' entries). It reads both thresholds from the built stylesheet, so a later change of either number needs no edit here.
