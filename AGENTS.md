# AGENTS.md

This file is read by coding agents that do not load `CLAUDE.md` automatically.
`CLAUDE.md` at the repository root is the full conventions record for SnowRaven
and applies to every agent; read it in full before changing anything. The
detailed rules live in `.claude/rules/*.md` and carry the same force.

## Device boundary

Work on the developer Mac and its local simulators only. Never discover, query,
pair, install on, or otherwise access any physical, production, or personal
device, including Hydra and Telesto. Do not access other machines for testing.
Do not infer which devices the user has. If a test requires a physical device,
ask the user to perform it and give exact steps; record the result they report.
Uploading a build to TestFlight does not authorize a device install or an App
Store submission. This is the user's direction of 2026-09-26 and overrides
older device-testing instructions elsewhere in the repository.

Automated tests are the usual verification path. Do not expand routine QA into
manual platform or device checks on your own. If an approved criterion remains
unverified and the user defers it, record it as partial and leave it deferred.

One rule is restated here because it must never be missed:

## Published copy needs the user's approval first

No change to `website/`, `README.md` or the App Store listing copy
(`appstore/LISTING.md` and what is written into App Store Connect) is made
without the user reading the new language and approving it first. Corrections
and one-word fixes included. Show the exact before and after as something the
user can open (a tailnet URL for the website, the README rendered, the App
Store text in full), wait for an explicit yes, and only then write it. A
feature build may propose at most one sentence for its tab's section and never
appends, rewrites or re-sequences on its own; a version-stamp step moves only
the website's version pill and footer. The register these surfaces are written
in, and the reasons for the rule, are in `.claude/rules/docs-and-website.md`.

The same holds in every run, hands-off Spool spins included (user direction,
2026-09-27, narrowed 2026-09-28), and extends to `PRIVACY_POLICY.md` (kept
identical to `website/privacy.html`) and the App Store "What's New" text. A
spin runs ungated until its bundle sign-off, so a build prepares those edits as
a held patch in its pipeline folder instead of writing them; they are shown to
the user rendered and applied only on an explicit yes, before the bundle ships.
In-app text and `docs/HELP.md` are written without a stop.
`docs/HELP.md` is not covered by this gate: it is the detail tier and a build
updates it in the same change as the feature.

Set by the user on 2026-09-21 and reaffirmed on 2026-09-22.
