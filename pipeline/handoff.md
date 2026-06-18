## What We Accomplished

A comprehensive accuracy pass over the docs and website. A verified audit (ground-truth → per-doc
audit → adversarial verify) checked README.md, docs/HELP.md, the website, ACCESSIBILITY.md, and
PRIVACY_POLICY.md against the shipped app (0.5.44), and the corrections it found were applied. The
most important: the privacy policy now discloses the in-app updater's connection to GitHub, which
was previously omitted. Shipped as a docs-only commit — no version bump, tag, or release.

## What Has Been Saved

- PRIVACY_POLICY.md, README.md, website/index.html, docs/HELP.md, ACCESSIBILITY.md (accuracy fixes)
- DECISIONS.md (the audit + privacy-disclosure entry)
- pipeline/docs-website-accuracy-audit/ (change-brief, security-report)

## Where We Are

Improvement complete. Committed and pushed to `main`; the website redeploys via GitHub Pages. No
app release — the only app-bundle change is a one-line `docs/HELP.md` wording tweak, which will
bundle with the next release.

## Resume Prompt

To resume: run `/weft` in this project. The pipeline is idle — start a new improvement, feature,
or fix whenever you're ready.
