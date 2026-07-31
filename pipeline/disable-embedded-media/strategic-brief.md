# Strategic Brief — Disable Embedded Media

## What We're Building

A durable, app-wide **Disable embedded media** option in Settings. It is off by
default, preserving today's behavior. When turned on, SnowRaven does not mount
Macaulay Library inline players in Species Detail's Recent Media or Named Birds;
where embed-backed content would otherwise appear, it shows the simple note
“Embedded media is disabled in Settings.” Link-based media features remain
available.

## Why Now

Macaulay Library embeds have become less reliable and can return provider error
pages instead of usable photos or audio. SnowRaven recently added resilient
fallbacks to both current embed surfaces, but those fallbacks cannot make the
third-party players dependable. A global opt-out gives users a deterministic,
quiet experience while preserving SnowRaven's local media analysis and direct
links.

## User Problem

A birder may prefer not to wait for, troubleshoot, or repeatedly see broken
third-party players. Today there is no way to turn them off without also avoiding
Species Detail and Named Birds. They need one persistent control that removes
all inline embeds without hiding useful media counts, comments, dates, checklist
links, or Macaulay Library links derived from their local export.

## Success Criteria

- Existing and upgraded installations keep embedded media enabled unless the
  user explicitly turns the option on.
- Turning the option on applies app-wide immediately, persists across relaunches,
  and prevents any Macaulay Library embed iframe from mounting or requesting its
  asset.
- Species Detail Recent Media and Named Birds show “Embedded media is disabled
  in Settings.” wherever embed-backed content would otherwise render, with no
  shimmer, failed-player frame, or offline fallback in its place.
- Turning the option back off restores the existing resilient embed behavior
  without requiring an app restart.
- Non-embedded media experiences remain unchanged, including export-derived
  analytics and comments, media counts, checklist links, and links that open the
  Macaulay Library.
- Automated coverage locks the default, persistence, immediate toggle behavior,
  both current embed surfaces, and the no-iframe guarantee.

## Scope

- One Settings control labeled **Disable embedded media**, off by default, with
  durable per-installation persistence through SnowRaven's existing settings
  storage seam.
- An app-wide preference gate that is resolved before iframe-backed content can
  mount, including on a relaunch with the option already enabled.
- The two current Macaulay Library embed surfaces: Species Detail Recent Media
  and the media section inside an expanded Named Birds row.
- One consistent disabled-state note, shown only where an embed-backed media area
  would otherwise be present.
- User documentation updated to explain the option, its default, and that direct
  media links remain available.

## Out of Scope

- Disabling ordinary outbound links to the Macaulay Library, eBird, or other
  providers.
- Hiding or changing locally computed media data, analytics, comments, counts,
  dates, or checklist associations.
- Disabling bird-link icons, maps, weather, or any non-media network request.
- Repairing Macaulay Library's embed service or changing SnowRaven's existing
  slow, failed, and offline fallback behavior when embeds are enabled.
- Downloading, caching, proxying, or re-hosting Macaulay Library media.
- Per-tab, per-species, or per-format embed controls.

## Key Decisions

- **Use a negative, off-by-default control.** “Disable embedded media” maps
  directly to the request while an absent, false, or invalid saved value preserves
  the current enabled behavior.
- **Suppress embeds before they mount.** Hiding an already-created iframe is not
  sufficient; the disabled state must prevent its third-party request and avoid a
  flash of player UI during preference hydration.
- **Make the setting global.** Both current surfaces consume the same app-level
  preference, and future Macaulay Library iframe surfaces must honor the same
  contract rather than adding independent controls.
- **Replace the embed area, not media functionality broadly.** Each affected area
  gets one concise note; ordinary Macaulay Library links and local media-derived
  information elsewhere remain intact.
- **Persist locally through the existing storage abstraction.** No account,
  cloud sync, new provider, or developer-operated service is introduced.
