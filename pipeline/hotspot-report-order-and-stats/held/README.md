# Held: published copy and frames this change makes stale

**Status: HELD for the user's yes.** Nothing in this folder has been written to a published surface. `website/`, `README.md`, `appstore/LISTING.md`, the App Store record, `PRIVACY_POLICY.md` and `fastlane/metadata/` are untouched by this build (CLAUDE.md, "Published copy needs the user's approval first"). Two files changed under `website/`, both test tooling the brief allows and neither published copy: `website/tools/verify/verify-hotspot-reports.mjs` (the real-engine harness, extended to the new layout) and `website/tools/verify/run.mjs` (that harness's time budget in the gate). Everything under `website/` is published by the Pages deploy (`.claude/rules/docs-and-website.md`, v1.0.56), and neither file carries a local path, host name, tailnet name, credential or user data.

| File | What it holds | Needed for |
|---|---|---|
| `website-alt-text.md` | The Hotspot Reports frame's `alt` text, before and after | Only once `hotspot-reports.webp` is recaptured: the current alt describes the current frame truthfully |
| `whats-new.md` | The proposed App Store What's New and the matching F-Droid changelog text | The deploy stage (1.0.72, version code 1000072) |
| `screenshots.md` | The four stale frames and the exact capture commands | The deploy stage, before the release goes out |

**Unchanged and still true** (checked sentence by sentence against the built report): the README `### Hotspot Reports` sentence, the website feature row's paragraph, and the App Store listing bullet ("your life list there, a map, your checklists by protocol, and the weather on your visits..."). Each names parts the report still has and claims no order, so no edit is proposed. `ACCESSIBILITY.md` and `PRIVACY_POLICY.md` make no statement about this tab's layout, figures or order, and nothing here changes what is stored, requested or cleared, so neither owes a sentence.
