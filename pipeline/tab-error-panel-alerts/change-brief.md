# Change Brief — tab-error-panel-alerts

## What is changing

All eight tab load-failure panels get an announcement that actually fires. The idea's numbers are **correct**: exactly Calendar (`Calendar.tsx:913`) and Map Explorer (`MapExplorer.tsx:3224`) carry `role="alert"`; BirdingStats, Checklists, BreedingCodeList, NamedBirds, SpeciesDetail and LifeList do not.
But this is **not a six-line attribute addition.** Each panel is an early `return` in a phase switch, so the region would be created at the instant its text exists — the repo's own documented "insert-with-first-message trap" (`ui.md:94`, DECISIONS.md v0.5.83). The region must be mounted **above** the phase switch, present from the `loading` phase, with the message arriving as a sequence-keyed child (v0.5.80). All eight tabs start at a loading phase, so it is always in the tree before the load resolves.
**The two precedents are unreliable for exactly this reason and correcting them is in scope** — otherwise we ship six copies of a pattern we know is broken and leave two behind.
Rider: `AlertCircle` carries no `aria-hidden` in BirdingStats, BreedingCodeList, SpeciesDetail and LifeList (lucide sets none by default); add it, so the region's `textContent` is exactly the sentence read aloud.

## Why now

The audit preceding this in the same bundle over-claimed on this exact point: `pipeline/cache-read-throw-containment/security-report.md` says the error phase "renders through an existing `role="alert"` region … (`Calendar.tsx:911-922` **and its siblings**)". Six of the eight siblings have no such region.
That fix also made this phase *more reachable* — an unreadable backup now lands here instead of on the setup screen — so the panel a user hits after a failed load is the one that stays silent.

## User-facing impact

None visually. Screen-reader users on the six silent tabs gain an announcement when a load fails; users on Calendar and Map Explorer gain a *reliable* one. No copy, control, layout or behavior change for sighted users.

## Design pass

**Not needed — no visual change.** Semantic ARIA plus a DOM-position change to an already-rendered region; no hierarchy, spacing, type, color, motion or layout moves.

## Decisions touched

- **v0.5.83** (~657-663) — a live region must be in the accessibility tree before its message; verify with `ariaSnapshot`, not by reasoning. **Applied and extended to eight surfaces, not reversed.**
- **v0.5.80** (~907-915) — the message goes in a sequence-keyed child. **Applied.** `ui.md:92/94`'s "region always rendered, only its child changes" gains eight compliant surfaces.
- **2026-05-22 `setup-required` vs `error` split — upheld and untouched.** `SetupRequired` and WeatherBacklog's `StateBlock` (the possible ninth surface) stay role-less: they are guidance, not errors, and an alert role there would contradict the `OfflineMessage` convention. Out of scope by decision, not omission.
- **`ACCESSIBILITY.md` is true today — verified, not accepted.** Its "inline errors are announced" sentence (line 23) and its offline-states section (line 75) both scope to other surfaces and never claim these panels announce. It must be **updated by this change**, since accessibility behavior changes.

## What done looks like

- All eight mount the region before the load resolves, and its DOM node **survives** the loading→error transition — asserted by node identity, not by discipline (a same-position wrapper each branch re-declares is the "registry, not discipline" failure CLAUDE.md warns about).
- Per-surface tests each with an absent case (single-sourcing prevents drift, not a dropped copy), a same-message-twice mutation test, and a stylesheet scan that nothing sets a hiding `display` on the region.
- `ariaSnapshot` with the region **idle**, in Chromium **and WebKit** (the engine the macOS and iOS apps ship on).
- `ACCESSIBILITY.md` updated; patch bump in both manifests + `CHANGELOG.md`. `docs/HELP.md`, `README.md` and `website/` are not implicated (no feature change).
- **Cannot be verified in this run — recorded as a gap, not papered over.** No screen reader, no human listener. An accessibility tree is a proxy for announcement, never proof of it. Whether VoiceOver actually speaks these on macOS and iOS — the platforms where an inserted-populated alert is least reliable, and the reason this is more than an attribute — needs the user on their own devices.
