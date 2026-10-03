# Decisions — Targets hotspot link

## 2026-10-02 — Icon follows the last word of a wrapping hotspot name, in the shared link

**Found at:** the user's live look at the built app (tailnet preview), during The Engineer's stage.

**What:** on a hotspot name that wraps, `HotspotLink` drew the name and the open-on-eBird icon as two side-by-side flex boxes (`display: inline-flex`). A wrapping name's box stretches to the full width of its container, so the icon sat at the far right edge rather than after the last word. The approved mockup had the same structure.

**User's decision:** "It would look much better and flow more logically if the link button was right next to the link." Asked to choose between fixing only the Targets link and fixing the shared component, they chose **the shared link**.

**Scope change:** `HotspotLink.tsx` changes in its full-name branch only (not `truncate`, not `compact`). Every surface that shows a full hotspot name gets the icon after the last word when the name wraps. The Designer's caller sweep found four: the Targets cell, Birding Statistics (`BirdingStats.tsx:860`), Named Birds (`NamedBirdLocations.tsx:65`) and Species detail (`SpeciesDetail.tsx:1710`). Every other call site (Map Explorer and county popups, the Weather backlog, the rest of Species detail, Named Bird rows) uses `truncate` or icon-only `compact` and is unchanged. (The Guide's first estimate to the user, "eight other spots", counted call sites before checking which use `truncate`/`compact`; corrected here.) One-line names, truncated names (whose two-box layout keeps the icon visible after the ellipsis) and icon-only links are unchanged. The Tester verifies those other surfaces as well as Targets.

**Routing:** a design amendment (Case 2: a scoped Designer errand on `design-refinement.md` and `design.html`, then a scoped Engineer errand), not a full stage re-run. The direction (green link, wrap, personal places unchanged) stands.

## 2026-10-02 — The glyph hangs into the Targets cell's padding

**Found at:** The Tester's browser sweep (QA report). The Guide had told the user the glyph lands on a line by itself only at 320px with 200% text; that was wrong. At normal text size, in windows 680 to 1040px wide (iPad portrait included), 17 of 119 rows put the glyph alone under a last word that fills its line (e.g. "Lake Elizabeth"). At 200% text it happens at every desktop width.

**User's decision:** asked to choose between leaving it and letting the glyph hang into the cell's spare padding, they chose **hang it into the margin**.

**Scope:** the Targets Last report cell only (it has 12px of horizontal padding on each side, enough for the 3px gap plus 10px glyph). The shared `HotspotLink` structure from the first amendment stands; the hang is a Targets-cell style rule. Other tabs are unchanged.

**Also corrected (QA):** the phone tap area measures 24 to 25px at normal text, not "about 28px"; the comments at `HotspotLink.tsx` ("never drops onto a line by itself") and `globals.css` ("about 28px"), and the edge-case wording in `pr-description.md` and `how-to-see.md`, are to be made true.

## 2026-10-02 — Security review notes (Auditor, passed with notes)

**F1, the name split's cost (declared here, per `.claude/rules/security.md`):** `HotspotLink`'s full-name branch splits the visible name with one `lastIndexOf(' ')` and two `slice` calls per render: linear in the name, no loop; the delimiter-absent case is a single full scan. Measured by the Auditor under 1 ms at 800,000 characters in four shapes. On Targets the name is also capped at 512 code units by `DAY_OBS_MAX_STRING`.

**F2, the v1.0.28 row-owned dispatch rule, accepted for this build:** the Targets table can be re-sorted, and its new hotspot links open on desktop and iOS through the opener plugin's global click listener, as every other `HotspotLink` and `ChecklistLink` in the app does. The listener takes the clicked anchor from the event's own `composedPath()` and reads that anchor's rendered `href`, which comes from the row's own validated id, so whatever opens is a validated `ebird.org/hotspot/L<digits>` page; there is no security impact. Moving shared links to row-owned dispatch (`onClick` calling `openExternalLink`) is a shared-component change outside this build's scope, left as an idea, and the Chronicler clarifies the two CLAUDE.md instructions that pull in different directions here. Reversal condition: any observed case of a shared link in a sorted or paged list opening a different row's page.

**F3 and F4 (pre-existing, code this build did not touch):** saved as ideas: a hotspot lookup that runs out of 429 retries keeps that state out of the session's hotspot list until a restart or a key or file save; and the self-hosted backend sets no browser security headers (`tauri.conf.json` also sets `"csp": null`).

**Screenshots:** this run's renders stay on disk and out of git (`pipeline/.gitignore`), because one shows the user's own checklist comment and the repository is public.
