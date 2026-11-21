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
