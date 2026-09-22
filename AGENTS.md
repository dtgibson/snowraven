# AGENTS.md

This file is read by coding agents that do not load `CLAUDE.md` automatically.
`CLAUDE.md` at the repository root is the full conventions record for SnowRaven
and applies to every agent; read it in full before changing anything. The
detailed rules live in `.claude/rules/*.md` and carry the same force.

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
`docs/HELP.md` is not covered by this gate: it is the detail tier and a build
updates it in the same change as the feature.

Set by the user on 2026-09-21 and reaffirmed on 2026-09-22.
