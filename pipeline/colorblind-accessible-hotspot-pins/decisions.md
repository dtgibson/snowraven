# Decisions — Colorblind-Accessible Hotspot Pins

## Design stage (The Designer)

1. **Tier cue is a segmented "tier ring", not texture, ticks, or pips.**
   A thin 5-segment ring inside the bulb rim (filled segments = tier,
   clockwise from top, faint 0.28-alpha track for the remainder). Chosen
   because it is judged by extent at 28px (no counting needed at map
   scale) and countable up close; a county-style crosshatch stays
   rejected per v0.5.92 (does not resolve on a teardrop bulb), tick
   marks fail at counting 4-vs-5 at pin scale, and pips collide with the
   kind glyph. One shared spec constant (cx 14, cy 14, r 11.1, width
   2.4, 5 segments, 16° gaps, start −90°) feeds the sprite bake, the
   legend minis, and the popup badge (NFR-10 same-source).

2. **Opt-in, not always-on (user decision, revision 2).** The first
   direction recommended always-on; the user chose the opt-in
   Use-Textures convention: "lets make the extra ring opt-in rather
   than on by default." Label **"Use Tier Rings"** — keeps the
   "Use …" prefix of the map's colorblind-aid family while naming the
   real mechanism (it is not a texture). Placed in the Color pins by
   block below the mode pills / above the status live region, revealed
   only while a non-default mode is active.

3. **Persistence: PERSISTED via the storage seam (key
   `hotspotTierRings`, default off) — a deliberate, user-approved
   deviation from the session-only county/atlas Use-Textures
   precedent.** Reason: this is a vision-linked accessibility
   preference, not a per-analysis view; re-enabling it every launch
   punishes exactly the user it serves. User approval in their own
   words: "That sounds good to me, including remembering the toggle."
   (County/atlas textures remain session-only; this decision does not
   reopen them.)

4. **No new CSS tokens.** Ring white `#fff` + track alpha 0.28 are
   sprite-baked literals in the `HOTSPOT_GLYPH_*` family (the
   basemap-anchored GL exception). White on t1 `#2C89AA` ≈ 4.0:1
   (>3:1 non-text); no text on fills, so the dormant 4.5:1 on-fill
   contrast clause stays dormant.

5. **In-view list dots (`HotspotModeDot`) deliberately unchanged in
   both toggle states.** 9px is below the cue's resolution and each
   dot sits beside its exact value in words.

6. **Mockup lint justification: the `banned-font` (Inter) warn from
   `weft-design-lint` is deliberately kept.** `pipeline/design-system.md`
   mandates Inter/system-ui as the established house face, and the Weft
   design doctrine's own precedence rule gives the project design
   system authority on type specifics; a mockup in a non-house display
   face would misrepresent the surface being refined. This is the only
   lint finding on `design.html`.
