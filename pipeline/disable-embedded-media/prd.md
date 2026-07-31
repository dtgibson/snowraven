# PRD — Disable Embedded Media

**Feature:** disable-embedded-media
**Date:** 2026-07-30
**Stage:** 2 — The Planner
**Source:** strategic-brief.md (approved)

---

## Feature Overview

SnowRaven will add a durable, app-wide **Disable embedded media** setting. It is
off by default, so fresh and upgraded installations retain today's behavior.
When enabled, the setting immediately prevents Macaulay Library embed iframes
from mounting in Species Detail's Recent Media and in expanded Named Birds rows.
Each affected media area instead shows the exact note “Embedded media is
disabled in Settings.” Existing local media data, analytics, comments, counts,
dates, checklist links, and direct Macaulay Library links remain available.
Turning the setting off restores the existing resilient, on-demand embed
behavior without a relaunch.

---

## User Stories

> **US-01** — As a birder who sees unreliable Macaulay Library players, I want
> one setting that removes all inline embeds, so that Species Detail and Named
> Birds remain quiet and predictable.

> **US-02** — As a user who disables embeds, I want that choice to survive a
> relaunch, so that third-party players do not return until I opt back in.

> **US-03** — As a user changing the setting, I want every open media surface to
> respond immediately, so that I never need to restart or reload SnowRaven.

> **US-04** — As a user who disables embeds, I want a short, consistent
> explanation where media would have appeared, so that the absence is clearly a
> preference rather than a loading failure.

> **US-05** — As a user who still wants my media information, I want direct
> links, dates, checklist associations, comments, counts, and analytics to remain
> available, so that disabling a player does not disable my local data.

> **US-06** — As a user who later trusts the provider again, I want to turn the
> setting off and get the existing resilient embeds back immediately.

---

## Functional Requirements

### Settings and persistence

> **FR-01** — Settings shall expose one accessible toggle labeled exactly
> **Disable embedded media**, with supporting copy explaining that it prevents
> inline Macaulay Library players while leaving direct links available.

> **FR-02** — The preference shall default to `false` (embeds enabled). A missing,
> malformed, or non-boolean saved value shall be treated as `false`, preserving
> current behavior for fresh and upgraded installations.

> **FR-03** — The preference shall persist per installation through SnowRaven's
> existing `storage` abstraction, with equivalent behavior on desktop and
> web/Pi. It shall not use component-local state or raw `localStorage` as its
> authoritative store.

> **FR-04** — A toggle change shall update the app-wide preference immediately
> and persist it without a separate Save action. A persistence failure shall be
> surfaced in Settings and shall not leave the control claiming a durable value
> that was not saved.

### App-wide preference gate

> **FR-05** — On startup, embed eligibility shall begin in an unresolved/closed
> state. No Macaulay Library iframe may mount until the durable preference has
> loaded and is confirmed `false`; this prevents a request or player flash when
> relaunching with embeds disabled.

> **FR-06** — When the loaded preference is `true`, an affected media area that
> has embed-backed content shall show the exact sentence **“Embedded media is
> disabled in Settings.”** once for that area. It shall not show the note where
> no embed-backed content would otherwise exist.

> **FR-07** — Enabling the preference while embeds are visible shall immediately
> unmount every current Macaulay Library iframe and prevent all subsequent iframe
> mounts or embed requests. Disabling it shall immediately make those surfaces
> eligible to render again without a relaunch or page refresh.

### Species Detail — Recent Media

> **FR-08** — Species Detail's Recent Media section shall consume the global
> preference before rendering any `RecentMediaEmbed` player or iframe-backed
> frame.

> **FR-09** — With embeds disabled and Recent Media available for the selected
> species, the section shall render the disabled note and no iframe, loading
> shimmer, failed-player overlay, or offline-player fallback. Existing
> non-embedded media labels, capture dates, checklist links, and direct Macaulay
> Library asset links shall remain available.

> **FR-10** — With embeds enabled, Species Detail shall retain its current
> resilient behavior: up to the most recent Photo, Audio, and Video, lazy iframe
> loading, offline/failed-load fallback, metadata, and link-outs.

### Named Birds media

> **FR-11** — The media section in an expanded Named Birds row shall consume the
> global preference before any lazy-mount, intersection-observer, batch, or
> `MediaFrame` path can create an iframe.

> **FR-12** — With embeds disabled and a named individual having matched media,
> its media section shall render the disabled note and no iframe, shimmer,
> failed-player overlay, or offline-player fallback. The individual's existing
> non-embedded media format/date metadata, checklist links, and direct Macaulay
> Library asset links shall remain available; no note shall appear for an
> individual with no matched media or when no ML export is loaded.

> **FR-13** — With embeds enabled, Named Birds shall retain its current behavior:
> media only after row expansion, bounded initial batch, intersection-based lazy
> mounting, Show more, collapse cleanup, resilient fallback, and existing empty
> states.

### Preserved behavior, coverage, and documentation

> **FR-14** — The preference shall govern every current Macaulay Library inline
> media iframe in SnowRaven. The implementation and tests shall inventory the two
> current surfaces—Species Detail and Named Birds—so a bypassing iframe callsite
> cannot remain.

> **FR-15** — The preference shall not hide or alter locally derived media
> analytics, comments, counts, dates, checklist associations, Multimedia or
> Statistics content, ordinary outbound Macaulay Library/eBird links, bird-link
> icons, maps, weather, or other non-media network behavior.

> **FR-16** — `docs/HELP.md`, `README.md`, and the website showcase shall explain
> the setting, its off-by-default behavior, the disabled note, and the continued
> availability of direct media links. `PRIVACY_POLICY.md` shall clarify that
> Macaulay embed requests occur only while embedded media is enabled.

> **FR-17** — Automated tests shall lock the default and invalid-value fallback,
> persistence, hydration-before-mount behavior, immediate on/off propagation,
> exact note copy and presence gates, both current embed surfaces, retained
> non-embed links/data, and the zero-iframe/zero-embed-request guarantee.

---

## Non-Functional Requirements

> **NFR-01 — Privacy and network behavior:** When disabled, SnowRaven shall make
> zero requests to `macaulaylibrary.org/asset/*/embed`. The feature adds no
> provider, account, cloud sync, analytics, telemetry, backend service, proxy,
> download, cache, or re-hosting path.

> **NFR-02 — Immediate and race-safe:** Preference changes shall propagate in the
> same app session without stale mounted frames. Startup hydration, rapid toggles,
> delayed iframe callbacks, timers, and intersection callbacks shall not bypass
> the disabled state or remount an iframe after disablement.

> **NFR-03 — Accessibility:** The Settings control shall use the project's
> keyboard-operable switch convention with an accessible name and visible focus.
> The disabled note shall be readable by assistive technology, meet WCAG 2.1 AA
> contrast in both themes, and not be announced as an error.

> **NFR-04 — Responsive design:** The control, note, and retained link/metadata
> content shall remain usable without horizontal overflow at approximately 320px
> width and at 200% text size, using existing design tokens and responsive
> classes.

> **NFR-05 — Cross-platform durability:** The same preference value and behavior
> shall hold across macOS, Windows, web/Pi, and supported mobile shells through
> the storage seam. Desktop shall not rely on WKWebView `localStorage`.

> **NFR-06 — No regression:** With the preference off, embed rendering, lazy
> loading, fallback behavior, media matching, batching, metadata, links, local
> analytics, and unrelated app behavior shall remain unchanged.

---

## Out of Scope

- Repairing, proxying, downloading, caching, re-hosting, or replacing Macaulay
  Library media.
- Disabling direct Macaulay Library/eBird links, bird-link icons, maps, weather,
  or any non-embed network request.
- Hiding or recalculating local media counts, analytics, comments, dates, or
  checklist associations.
- Separate controls by tab, species, media format, or session.
- Changing the existing slow, failed, or offline fallback behavior while embeds
  are enabled.
- Adding an account, cloud synchronization, developer-operated service, or
  telemetry.

---

## Open Questions

None. Existing settings storage, toggle, embed, fallback, and link conventions
resolve the implementation-facing details needed for planning.

---

## Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | Settings control and default (FR-01, FR-02) | The exact control is accessible; fresh, absent, malformed, and non-boolean values all leave embeds enabled. |
| QA-02 | Durable cross-platform persistence (FR-03, FR-04) | A saved on/off value survives relaunch through the storage seam on desktop and web/Pi; no Save action is needed, and a forced save failure is visibly reconciled. |
| QA-03 | Closed startup hydration (FR-05) | With a stored `true` value and a delayed settings read, no embed iframe mounts and no embed request occurs before or after hydration. |
| QA-04 | Exact, correctly gated note (FR-06) | Each affected area with embed-backed content shows exactly “Embedded media is disabled in Settings.” once; content-less areas show no note. |
| QA-05 | Immediate global toggle behavior (FR-07) | Turning on removes all mounted embed iframes in the same session and blocks later mounts; turning off restores eligibility without reload. |
| QA-06 | Species Detail disabled path (FR-08, FR-09) | Recent Media shows the note with zero iframe/shimmer/fallback nodes while its existing labels, dates, checklist links, and ML links remain available. |
| QA-07 | Species Detail enabled path (FR-10) | With the setting off, Photo/Audio/Video selection, lazy loading, resilient fallback, metadata, and links match the pre-feature behavior. |
| QA-08 | Named Birds disabled path (FR-11, FR-12) | An expanded bird with matched media shows the note and retained metadata/links with zero iframe/shimmer/fallback nodes; no-media and no-ML cases retain their current states without the note. |
| QA-09 | Named Birds enabled path (FR-13) | With the setting off, expansion gating, initial-six batching, intersection loading, Show more, cleanup, fallback, and empty states remain unchanged. |
| QA-10 | Complete iframe inventory (FR-14) | A repository/test inventory finds no current Macaulay embed iframe outside a global preference gate; both known surfaces are explicitly covered. |
| QA-11 | Preserved non-embed behavior (FR-15) | Media analytics/comments/counts/dates/checklist associations, direct links, icons, maps, weather, and other network features behave identically with the setting on or off. |
| QA-12 | Documentation accuracy (FR-16) | Help, README, website, and privacy policy describe the option, default, note, retained direct links, and conditional embed requests accurately. |
| QA-13 | Automated regression suite (FR-17) | Tests cover every state named in FR-17 and pass in the normal CI/build pipeline. |
| QA-14 | Privacy, races, accessibility, responsive, and platform quality (NFR-01–NFR-06) | Network inspection shows zero embed requests while disabled; rapid-toggle/delayed-callback tests do not remount; AA/keyboard checks pass; 320px and 200% layouts do not overflow; all supported runtimes agree; setting-off baselines remain green. |
