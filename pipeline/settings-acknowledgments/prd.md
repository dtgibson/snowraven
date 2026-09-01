# PRD — Settings Acknowledgments
**Feature:** settings-acknowledgments
**Date:** 2026-08-31
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

## Feature Overview

A new Acknowledgments section in the Settings tab, on every platform, whose button reveals a short, permanent thank-you naming The Cornell Lab of Ornithology and the Macaulay Library, and Deven Simonson. The content is fixed, fully offline, and identical everywhere.

## User Stories

> **US-01** — As the app's developer, I want the shipped product itself to credit The Cornell Lab of Ornithology, the Macaulay Library, and Deven Simonson, so that SnowRaven acknowledges the platform and the tooling access it was built on.

> **US-02** — As a SnowRaven user browsing Settings, I want to find and press an Acknowledgments affordance, so that I can read who and what the app credits.

> **US-03** — As a keyboard-only user, I want to open, read, and dismiss the acknowledgments entirely with the keyboard, so that this section is as usable to me as every other Settings section.

> **US-04** — As a screen reader user, I want the affordance clearly labeled and the reveal state programmatically determinable, so that I can perceive and operate the section without guessing.

> **US-05** — As a user running SnowRaven with no network connection (desktop or self-hosted Pi), I want the acknowledgments to display fully offline, so that no part of the app quietly depends on the network or an API key.

## Functional Requirements

### Settings entry point

> **FR-01** — The Settings tab shall include an Acknowledgments section rendered in the tab's established section vocabulary: a `SectionHeader` labeled "Acknowledgments" plus a single action row containing one button, matching the shape of the existing "Help & Documentation" section (icon tile, title, one-line description, trailing action button).

> **FR-02** — The action row's button shall have a visible text label and an accessible name that identify its purpose (default copy: button label "View acknowledgments"; row title "Acknowledgments"; row description "The people and institutions behind SnowRaven."). Activating the button shall reveal the acknowledgments content.

> **FR-03** — While the button has not been pressed, every existing Settings section and behavior shall be unchanged: no existing section moves, changes copy, or changes behavior, and the new section adds no behavior beyond its own reveal.

### Reveal and dismissal

> **FR-04** — Activating the affordance shall reveal the acknowledgments content. The reveal mechanism (inline disclosure within the Settings tab vs. a full overlay like the Help documentation) is The Designer's decision at Stage 3; whichever form ships shall satisfy FR-05, FR-06, FR-15, FR-16, and the non-functional requirements below.

> **FR-05** — The user shall be able to dismiss the revealed content and return to Settings exactly as they left it. If presented as an overlay, every close affordance offered (close button, Escape, backdrop if any) shall route through one close path that restores focus to the opening button. If presented as an inline disclosure, collapsing shall keep focus on the toggle, and the collapsed content shall not be reachable by keyboard or exposed to assistive technology.

> **FR-06** — Repeated open and close cycles shall be idempotent: no duplicated content, no accumulated state, no console errors, and no change in what a subsequent open displays.

### Acknowledgments content

> **FR-07** — The revealed content shall contain exactly two acknowledgment entries, in this order: (1) The Cornell Lab of Ornithology and the Macaulay Library; (2) Deven Simonson. The app shall present no other acknowledgees, third-party service credits, or license notices in this section.

> **FR-08** — Entry 1 shall name The Cornell Lab of Ornithology and the Macaulay Library and convey that they created a wonderful platform for tracking birding data and made it freely available. Default copy: "The Cornell Lab of Ornithology and the Macaulay Library, for creating a wonderful platform for tracking birding data and for making it freely available."

> **FR-09** — Entry 2 shall name Deven Simonson and convey that he provided early access to Weft to help build the SnowRaven app. Default copy: "Deven Simonson, for providing early access to Weft to help build the SnowRaven app."

> **FR-10** — All user-facing copy in this feature shall be plain prose obeying the repo copy rules, including no em dashes (U+2014) in any string.

> **FR-11** — External links in the content are optional, not required. If any entry links out (for example to the Cornell Lab or Macaulay Library sites), the link shall go through the shared `OutboundLink` component with the canonical "(opens in a new tab)" cue, and the content shall remain fully readable without activating any link. The Deven Simonson entry shall carry no link.

### Offline, privacy, and platform behavior

> **FR-12** — Opening and viewing the acknowledgments shall trigger no network request and require no API key. (If optional links ship, network activity occurs only when the user activates a link, never on reveal.)

> **FR-13** — The feature shall write no persisted state: no new settings keys, no storage-seam writes, no `localStorage`, no reveal-state memory across sessions.

> **FR-14** — The feature shall behave identically on macOS, Windows, web/Pi, and iOS: one shared surface with no `isTauri()` or other platform branch in the feature's code.

### Keyboard and assistive technology

> **FR-15** — The feature shall be fully operable by keyboard alone: the button reachable in the tab order and activatable with Enter and Space, the revealed content reachable, and dismissal possible without a pointer (including Escape if the reveal is an overlay).

> **FR-16** — The reveal state shall be programmatically determinable (for example `aria-expanded` on a disclosure toggle, or dialog semantics on an overlay). The content is reference material, not an event: opening it shall not trigger an automatic live-region announcement of the content body.

### Documentation and release (same change)

> **FR-17** — The change shall update `docs/HELP.md`, `README.md`, and `website/` to describe the Acknowledgments section in the same change, and shall add a `CHANGELOG.md` entry under a patch version bump applied to BOTH `frontend/package.json` AND `src-tauri/tauri.conf.json` (same version; 1.0.9 is current at time of writing).

## Non-Functional Requirements

> **NFR-01 — Accessibility:** The section, its reveal, and its content shall meet the app's WCAG 2.1 AA posture, holding at 320px viewport width and 200% in-app text scale with no horizontal page scroll, with focus behavior per the repo's overlay and disclosure rules and phone-tier touch-target posture on the button.

> **NFR-02 — Theming:** Every color in the feature shall use `var(--sr-*)` tokens and render correctly in both light and dark themes; no hardcoded hex or RGB values in component code.

> **NFR-03 — Copy:** No em dashes (U+2014) in any user-facing string or in the prose added to the published docs surfaces; if links ship, the new-tab cue uses the canonical "(opens in a new tab)" wording.

> **NFR-04 — Offline and privacy:** Fully offline: no network call, no API key, no new persisted state, nothing collected. The feature must not weaken the app's local-first privacy posture or require any change to `PRIVACY_POLICY.md`.

> **NFR-05 — Performance:** No new weight on the entry chunk (`entryChunk.test.ts` stays green). If the reveal ships as a separate overlay component, it loads lazily, following the existing `HelpDocs` lazy-load pattern.

> **NFR-06 — Compatibility:** Identical rendering and behavior across macOS (WKWebView), Windows (WebView2), web/Pi browsers, and iOS, with no platform-specific variant.

## Out of Scope

- Third-party data or software credits (OpenWeather, NOAA, OpenStreetMap/Nominatim, MapLibre, tile hosts). Provider attribution already lives where it is owed (the map attribution control and `PRIVACY_POLICY.md`); a credits inventory would be its own feature.
- An open-source license inventory or legal-notices screen.
- Any change to existing attribution surfaces: the map attribution control, `PRIVACY_POLICY.md`, `ACCESSIBILITY.md`.
- Any new network call, API usage, or persisted setting.
- Platform-specific variants of the section (no `isTauri` branch, no per-platform copy).
- Folding the acknowledgments into the Help documentation content (`HelpDocs`): this is its own Settings section, and `docs/HELP.md` changes only to mention that the section exists.
- An About screen, version display, or any other new Settings section beyond Acknowledgments.
- Localization of the copy.

## Open Questions

1. **Reveal mechanism: inline disclosure or overlay?**
   Default: The Designer decides at Stage 3, bounded by the AA / 320px / 200% criteria and FR-05/FR-15/FR-16. The PRD is deliberately mechanism-neutral; both forms have shipped precedent (collapsed-disclosure rules and the `HelpDocs` overlay rules in `.claude/rules/ui.md`).

2. **Where in the Settings tab order does the section sit?**
   Default: rendered as the last section of the Settings tab, leaving every existing section's position untouched; The Designer may place it elsewhere (for example adjacent to Help & Documentation) without a PRD change.

3. **Do the entries carry outbound links?**
   Default: no links. If The Designer includes them, entry 1 may link to the official Cornell Lab of Ornithology and Macaulay Library sites via `OutboundLink` per FR-11; the Deven Simonson entry carries no link in any case.

4. **Is the default copy final?**
   Default: the copy given in FR-02, FR-08, and FR-09 ships as written. The Designer may refine wording provided the names, the substance fixed by the strategic brief, and the copy rules (FR-10) are preserved. No acknowledgees may be added or removed.

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Settings entry point (FR-01, FR-02, FR-03) | The Settings tab shows an Acknowledgments section as a `SectionHeader` plus one action row with one labeled button; every pre-existing Settings section renders and behaves exactly as before the change. |
| QA-02 | Reveal (FR-04) | Pressing the button reveals the acknowledgments content; both entries are visible without further interaction beyond scrolling. |
| QA-03 | Content exactness (FR-07, FR-08, FR-09) | The content contains exactly two entries in order: (1) The Cornell Lab of Ornithology and the Macaulay Library, crediting the platform and its free availability; (2) Deven Simonson, crediting early access to Weft. No other acknowledgees, credits, or notices appear. |
| QA-04 | Dismissal and focus (FR-05) | Closing the content returns the user to Settings unchanged; in overlay form, Escape and the close control both close it and focus returns to the opening button; in inline form, collapse keeps focus on the toggle and collapsed content is unreachable by Tab. |
| QA-05 | Repeated open/close (FR-06) | Five consecutive open/close cycles produce no duplicated content, no console errors, and an identical view on every open. |
| QA-06 | Keyboard-only walkthrough (FR-15) | With no pointer: Tab reaches the button, Enter and Space each open the content, all content is reachable, and the content can be dismissed by keyboard. |
| QA-07 | Assistive technology semantics (FR-16) | The reveal state is programmatically determinable (`aria-expanded` or dialog semantics); opening produces no automatic live-region announcement of the content body; the button's accessible name matches its visible label. |
| QA-08 | Offline (FR-12) | With the network inspector open and no API keys configured, opening and viewing the acknowledgments issues zero network requests and renders fully. |
| QA-09 | No persisted state (FR-13) | After opening and closing the section, no new settings key, storage-seam write, or `localStorage` entry exists (desktop: `data/settings.json` unchanged). |
| QA-10 | Theming (NFR-02) | The section and its content render correctly in both light and dark themes; the new code contains no hardcoded hex or RGB color values, tokens only. |
| QA-11 | 320px and 200% text scale (NFR-01) | At 320px viewport width and 200% in-app text scale, in both themes: no horizontal page scroll, all content readable and reachable, AA contrast holds, and the button meets the phone-tier touch-target posture. |
| QA-12 | Copy rules (FR-10, NFR-03) | No U+2014 character exists in any new user-facing string or in the prose added to `docs/HELP.md`, `README.md`, or `website/`. |
| QA-13 | Entry chunk (NFR-05) | `entryChunk.test.ts` passes; any new overlay component is lazy-loaded and absent from the entry chunk. |
| QA-14 | No platform branch (FR-14, NFR-06) | The feature's code contains no `isTauri()` or other platform check; the section renders and behaves identically on desktop and web (spot-checked on both). |
| QA-15 | External links, if present (FR-11) | Every external link in the content routes through `OutboundLink` with the "(opens in a new tab)" cue; the Deven Simonson entry has no link; the content is fully readable without activating any link. Passes vacuously if no links ship. |
| QA-16 | Docs trio (FR-17) | `docs/HELP.md`, `README.md`, and `website/` are all updated in the same change to describe the Acknowledgments section. |
| QA-17 | Changelog and version bump (FR-17) | `CHANGELOG.md` carries an entry for this feature under a patch version bump, and `frontend/package.json` and `src-tauri/tauri.conf.json` state the same new version. |
