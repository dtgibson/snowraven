# Decisions: security-bloat-deps-and-tests-cleanup

## D-01 Mode and priority (user, 2026-11-20)
Studio Style, with real questions welcome along the way. The priority is stability and efficiency. The test work includes GitHub's automated checks that were failing.

## D-02 The shipped-code half ships as 1.0.75 in this run (user, 2026-11-20)
Asked whether removing the three uncalled system-keychain commands and the `keyring` crate, with the per-crate updates of the TLS, certificate and archive libraries, should go out as one patch release to every platform in this run. Answer: ship 1.0.75, after the no-release strands land and GitHub's checks are green. It carries the full all-platform rhythm, the user's approval of the What's New sentence and the three F-Droid changelogs, and the user's iPhone launch check.

## D-03 GitHub's checks and the Windows build move to Node 24 (user, 2026-11-20)
The open ROADMAP decision (raised at 1.0.46) is taken: yes. Both workflows follow `.nvmrc`, and testing.md's Node 20 sizing rule is restated against the Node that CI runs.

## D-04 Changes reach GitHub as a branch and a draft pull request (user, 2026-11-20)
Offered: a branch with a draft pull request, pushing to `main` as each piece is ready, or keeping everything local until the end. Answer: branch and draft pull request. `main` stays untouched until the sign-off at the deploy step. Branch: `improve/security-bloat-deps-and-tests-cleanup`. The `Pipeline` workflow runs on pull requests against `main`, so the checks are observed there.

## D-05 Timing checks on GitHub (settled by the Evaluator from the user's words, 2026-11-20)
A speed-ratio row keeps blocking GitHub's checks only in a form that reads steady there (a work count or structural assertion first, else a same-run CPU quotient with a measured margin and a control). A row that cannot reach that runs in the local full suite behind one named switch. No limit is raised to fit a reading. This decides the ROADMAP item "Pipeline Frontend job: stabilise, or rule it advisory" as stabilise.

## D-06 Five saved fixes ride along in 1.0.75 (user, 2026-11-20)
Offered: the four small security fixes left by earlier reviews; those plus the bar-chart reader memory fix; or a minimal release. Answer: the security fixes and the bar-chart fix. In scope for 1.0.75: `3eb8682b` (an eBird location id is shape-checked before it enters a request address, both transports), `25608818` (`regionName` uses `Object.hasOwn`, and the region link is shape-checked), `c7cf73d6` (a non-text breeding code reads as empty, both transports), `c5fa8455` (a non-text checklist location name reads as empty, both transports), and `b1e71586` (the bar-chart reader builds each name in one piece). This overrides the brief's "out of scope: one-off defect fixes" for these five only.

## D-07 GitHub runs the native tests on a Mac job (user, 2026-11-20)
Offered: a `macos-latest` job running all 140 Rust tests beside the existing checks, or no job. Answer: add the Mac job. Reversal, stated to the user: if it does not read steady across the three consecutive green runs this run requires, it comes back out and the user is told. An ubuntu job was ruled out by the Engineer's measurement (76 of 140, plus a second apt surface and a frontend build).

## D-08 The `zip` advisories are held, with a written disposition (the Guide, 2026-11-20)
Closing them needs tauri-plugin-updater 2.14.1, which requires a Tauri upgrade and drops the vendored `tao` patch from the graph (the iPhone launch-crash fix and the widgets' cold-start URL). Under the user's stated priority of stability, 1.0.75 does not take that upgrade. The Engineer writes where zip extraction can run per platform and that it follows the minisign check; the Auditor judges it. What would reverse it: the Auditor finding a reachable path, or a planned Tauri upgrade with the patch re-vendored.

## D-09 A wrapped tile label under a DejaVu-width font is a known limitation (the Guide, 2026-11-20)
GitHub's first real-browser run showed Hotspot Reports' "Species per hour" label taking two lines. Measured cause: the Linux runner's fallback font. Inter, SF, Roboto and a Segoe UI stand-in all read 0 wraps, so no Mac, Windows, iPhone, iPad or Android user sees it; a Linux browser on the web/Pi build with a DejaVu-width UI font does, cosmetically (no overlap, no clipping). No app change in this run; saved to the idea inbox with the location (`.sr-hsr-tiles`, `globals.css`).

## D-10 The version bump stays one release commit at the deploy step (the Guide, 2026-11-20)
As in every prior release, the six-file bump, the changelog entry and the three F-Droid changelogs land as one `chore(release)` commit after the user approves the published sentence. The Engineer holds the proposed copy in `release-copy-held.md`.

## D-11 Release sign-off: ship 1.0.75 with the shorter sentence (user, 2026-11-20)
Asked at the deploy gate, with the sentence inside the question: "Ship SnowRaven 1.0.75 to every platform? ... Saying yes lands the cleanup on main, tags v1.0.75, and publishes to Mac, Windows, and Android, then uploads to TestFlight; F-Droid picks it up from the tag. This cannot be undone. The App Store submission waits for your iPhone check of the TestFlight build, which will include the widget steps left owed since 1.0.71 (you can skip those when I ask)." Offered: ship with "Security and reliability fixes, including safer handling of unusual eBird data and hand-edited backups."; ship with the shorter sentence; cancel. Answer: **"Ship with the shorter sentence"**. The App Store What's New and the three F-Droid changelogs read exactly: `Security and reliability fixes.` This answer authorizes the fast-forward of `main`, the tag, `release.sh`, the Android attach (Partial device check, standing decision), the TestFlight upload, and the edits to `fastlane/`, `website/index.html` (version pill, its `aria-label` and the footer only) and `CHANGELOG.md` in the release commit. It does not authorize the App Store submission, which waits for the user's reported iPhone check of the exact uploaded build.
