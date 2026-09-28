# Strategic Brief — Own Macaulay Media in a Personal Life List

## What We're Building

The proposed feature is an off-by-default setting beside **Disable embedded media** that would show a birder's own Macaulay Library photos, audio, and video in SnowRaven by fetching files from Cornell's CDN. **Stop/go decision: no-go for direct CDN fetching now.** The available Cornell guidance permits downloading one's own original uploads through the specimen page, but does not establish permission for SnowRaven to construct CDN URLs or automate those downloads. This brief records the requested behavior and the condition for reconsidering it; it does not approve a substitute feature.

## Why Now

The existing Macaulay Library iframe players can be blocked by Cornell's Anubis check, so a birder may see metadata and a link instead of their media inside SnowRaven. The ML export already gives SnowRaven the catalog IDs and media types needed to organize a personal life list, which makes direct display attractive. The repo deliberately rejected CDN rendering when the embed gate appeared (DECISIONS.md, v0.5.76); changing that posture requires affirmative permission, not just a narrower toggle.

## The User Problem

A birder reviewing their own life list wants to see or play the media they uploaded without opening each Macaulay Library page. Today they can follow the asset links, while the inline player may be unavailable. They also need SnowRaven to respect Cornell's rules and avoid fetching anyone else's media under a setting that says it is for their own uploads.

## Success Criteria

- A future solution shows or plays only media the user is entitled to use, through a method Cornell permits, with a clear link back to each Macaulay Library specimen.
- Turning the feature off prevents its media requests; an unconfirmed or unreadable preference never starts a fetch.
- A user can still reach the official specimen page when inline viewing is unavailable.
- Any first-enable warning and confirmation accurately describe the permitted behavior and receive the user's express approval before they are written into the app.
- The privacy disclosure accurately names the requesting component, destination, and data sent before a new network path ships.

## Scope

- Preserve the requested product intent: optional access to the user's own ML media alongside their personal life list.
- Resolve Cornell's permission for automated, app-initiated access to the specific CDN path before planning or implementing direct fetches. The answer must cover original versus derivative files, display versus download, ownership verification, rate limits, and attribution.
- If permission is granted, design the setting as a separate, off-by-default choice near **Disable embedded media**, with a first-enable warning and explicit confirmation. Treat the exact wording as an unapproved proposal until the user approves it.
- Keep the present metadata, official asset links, and embed fallback available while the permission question is unresolved.

## Out of Scope

- Implementing direct CDN URLs, prefetching, bulk download, or persistent media caching on the current evidence.
- Fetching arbitrary catalog IDs, including media uploaded by other people, even if an ML export contains them.
- Treating a user confirmation, an ML export filename, or possession of a catalog ID as proof of ownership or as Cornell's authorization.
- Bypassing, solving, or hiding Cornell's Anubis protection.
- A local-file import or attachment workflow until the user chooses that direction; it is a possible alternative, not an approved replacement for the requested feature.
- Writing any UI text, help text, privacy-policy text, website copy, README text, or App Store copy in this stage.

## Key Decisions

- **No-go now:** do not build a setting that directly fetches ML media from `cdn.download.ams.birds.cornell.edu`. Technical reachability is not evidence of permission, and the existing v0.5.76 decision explicitly rejected that route around Cornell's protection.
- **Conditional go:** reconsider direct fetching only with explicit Cornell guidance or written permission for this app's automated access, plus a credible way to constrain requests to the user's own media. If either is unavailable, keep this path closed.
- The official guidance gives the user a safe current route: open their own specimen page and use **Download original** there. SnowRaven can continue linking to those pages. A future locally supplied media-file workflow could avoid app-initiated CDN fetching, but its design and scope require a separate user decision.
- The user's express approval is required before any user-facing wording is written, including the proposed setting label, warning, confirmation, help, and privacy disclosure. The separate published-copy gate also covers `website/`, `README.md`, and `appstore/LISTING.md`.
- **User decision, 25 September 2026:** seek Cornell's permission for the requested direct-fetch route. The direct CDN implementation remains on hold until Cornell gives an explicit answer covering the conditions above. The request is drafted in [permission-request.md](permission-request.md) for the user's review; nothing has been sent or submitted, and no local-file alternative is approved.
- **Contact decision, 25 September 2026:** the user declined submission of the drafted request. No agent will contact Cornell on this run without a new, explicit authorization. The feature cannot proceed to implementation on the current permission evidence.

## Evidence and Permission Boundary

- [Cornell/eBird Help, “Request and download media from the Macaulay Library”](https://support.ebird.org/en/support/solutions/articles/48001064551-using-and-requesting-media), marked modified **29 May 2025**, checked **25 September 2026**: “media are not available for personal download unless they belong to you.” It says a contributor's “original uploaded files are available” by clicking **Download original** on a specimen page. This confirms the user's manual download route for their own originals; it does **not** say an independent app may call the CDN directly, automate downloads, or use derivative-size endpoints.
- The same official article describes exporting catalog metadata from search results, including search criteria across the archive. Therefore an exported row or catalog number alone does not establish that the logged-in user owns that asset.
- [Cornell/eBird Help, “Crediting and citing media from the Macaulay Library”](https://support.ebird.org/en/support/solutions/articles/48001064570-crediting-media), marked modified **29 May 2025**, checked **25 September 2026**, specifies attribution for permitted use. It does not grant automated CDN access.
- The [Macaulay Library terms page](https://macaulaylibrary.org/terms-of-use/) returned Cornell's Anubis challenge, rather than readable terms, when checked **25 September 2026**. The broader terms could not be verified from that page. The stop decision rests on this unresolved permission, not on a claim that Cornell expressly forbids every automated use.
- SnowRaven's [existing decision](../../DECISIONS.md) at v0.5.76 records that the CDN paths worked technically and were deliberately rejected as a route around protection. The [media-embed rule](../../.claude/rules/media-embeds.md) carries that decision forward. The product brief's promise to work alongside Cornell supports keeping the narrower, permission-first boundary.
