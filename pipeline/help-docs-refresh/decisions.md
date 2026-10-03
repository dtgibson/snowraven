# Decisions: help-docs-refresh

## Deploy preparation (Stage 5, 2026-10-02)

What "deploy" means here: no version bump (the change brief's recommendation, confirmed or
overturned by the user at the production gate). Production is landing this branch on
`origin/main` as a fast-forward push from this worktree. The online documentation is
`docs/HELP.md` on GitHub `main`, which the website footer links to
(`https://github.com/dtgibson/snowraven/blob/main/docs/HELP.md`). The in-app Help reaches users
with the next app release.

**Preconditions.** `qa-report.md`: PASSED. `security-report.md`: PASSED WITH NOTES, no Critical
or High; one Low (L1). The Engineer's two HELP.md fixes made after the Auditor were re-checked:
- L1: the API Keys sentence now reads "Keys are saved where you run SnowRaven and are never sent
  to the developer", with no "securely".
- I7: the clear-backup sentence in Default Files now lists the day-by-day eBird answers behind
  the Targets tab's live counts and the position Alerts last read. The extended row in
  `targetsPublishedClaims.test.ts` holds both to the code: `county-day-obs.json` is registered in
  `clearDerived.ts`, and `purgeInbox()` in `AlertsEngine.swift` sets `st.position = nil`.

**Commit.** `f1006c1` on `weft/help-docs-refresh` ("docs: bring Help up to date through 1.0.45
(help-docs-refresh)"). It contains `docs/HELP.md`, `frontend/src/components/HelpDocs.tsx`, the
four guard tests (`helpToc`, `targetsPublishedClaims`, `widgetsPublishedClaims`,
`widgets/widgetCopy`) and the tracked pipeline files. `pipeline/.gitignore` kept `qa-report.md`,
`security-report.md` and `how-to-see.md` out. No change to `PRIVACY_POLICY.md`,
`ACCESSIBILITY.md`, `website/**`, `README.md`, `CHANGELOG.md` or any version file. This notes
file rides in a second commit, which touches only `pipeline/`.

**Reconcile.** `weft-worktree reconcile`: `RECONCILED clean`. Nothing new was merged; HEAD stayed
`f1006c1` over base `a98efa9`, so the full suite was not re-run (QA's full run stands).

**Checks re-run after the commit** (load average about 4):
- Help-related suites: every test file that reads `HELP.md`, `HelpDocs` or `helpToc`, plus
  `icloudBarChartPublishedClaims`, `tabOrderCoverage` and `entryChunk`. 32 of 32 files and 661
  of 661 tests passed. That includes all 11 `*PublishedClaims*` suites, `HelpDocs`,
  `HelpDocsHostileContent`, `helpToc`, `helpLinks`, `helpContentWidthCss`,
  `settingsSectionOrder`, `widgets/widgetCopy` and `privacyPageParity`.
- `npm run typecheck`: exit 0.
- `npm run build`: exit 0, only the usual chunk-size advisory.

**Cargo (`git log origin/main..HEAD` after `git fetch origin`, `origin/main` = `a98efa9`).**
- `f1006c1`: this build's own commit.
- The commit carrying this file: record-keeping (`pipeline/` only).
- No other app-behavior cargo.
The push is a fast-forward: `git merge-base --is-ancestor origin/main HEAD` holds, and
`HEAD..origin/main` is empty. `weft/help-docs-refresh` does not exist on origin yet.

**CI on `main` before this lands.** The tip `a98efa9` is green (Pipeline, success). Of the four
runs before it, two were cancelled (superseded) and one failed:
- `63e5c3b` failed in the Frontend job on the load-sensitive `parseBarChart.test.ts` timing
  ratio (3.37 against a limit of 3.2).
- The pending Spool bundle's `barchart-speed-check-ci` run names that row as a residual.
- This change does not touch that file.
A push to `main` that touches only these paths starts `pipeline.yml` alone. `pages.yml` runs
only on `website/**`, and the Windows build runs only on `v*` tags, so the website itself is not
redeployed.

**Merge readiness with the Spool bundle (`weft-spool/20261002-160902`, `8cbbb62`).**
- `git merge-tree --write-tree HEAD weft-spool/20261002-160902` came back clean: exit 0, tree
  `f0ca1aa`, no conflicted paths.
- `docs/HELP.md` is the only file both branches change. The bundle rewrites one paragraph,
  "Turning it off".
- The merged file carries both changes and has no conflict markers.
- None of the bundle's changed tests reads `HELP.md`, and no guard on this branch pins the
  clause the bundle rewrites.

**Push, after the user confirms at the production gate** (run from this worktree; a plain push
refuses anything but a fast-forward):
1. `git fetch origin` and `git merge-base --is-ancestor origin/main HEAD`. If `main` has moved,
   for example because the Spool bundle landed first, run `weft-worktree reconcile` and the full
   frontend suite again before pushing.
2. `git push origin weft/help-docs-refresh`
3. `git push origin weft/help-docs-refresh:main`
4. Check that the GitHub `main` copy of `docs/HELP.md` shows the new text, for example the
   welcome-screen paragraph and the "never sent to the developer" sentence. Then watch the
   Pipeline run on the new tip.
