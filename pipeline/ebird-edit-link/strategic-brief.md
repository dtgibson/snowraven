# Strategic Brief — eBird Edit Link
**Feature:** ebird-edit-link
**Session:** 001
**Date:** 2026-05-08
**Stage:** 1 — The Strategist

---

## The Opportunity

The weather lookup workflow has one remaining friction point: after copying the formatted weather block, the user must manually navigate to their eBird checklist, find the comment field, and paste. A direct "Edit checklist" link — appearing alongside the weather output — eliminates that navigation step entirely. The user clicks, the eBird edit page opens, they paste.

## Strategic Fit

This is squarely within SnowRaven's mission. The product brief defines success as getting weather data "ready to copy and paste" with minimum friction. The edit link is the logical final step of that same workflow — it doesn't add any new surface, accounts, or complexity. It's purely a time-saver for the exact user the product was built for.

## The Deep-Link Question

The user asked whether the link could open directly to the comment field. eBird's edit page (`/edit/effort?subID=S…`) does render a comment textarea, but eBird's HTML doesn't expose a named anchor that survives their JavaScript rendering. A URL fragment won't reliably scroll to the field cross-browser. The pragmatic answer: link to the edit page — the comment field will be visible on that page. Deep-linking is not possible without eBird cooperation.

## Scope

- Show an "Edit checklist on eBird" link in the results area after a successful lookup
- Link target: `https://ebird.org/edit/effort?subID={checklist_id}`
- Opens in a new tab
- Appears near the checklist confirmation line (the `S… / location / date` row)
- No backend changes — the checklist ID is already in the frontend state
- Pure frontend addition; very small surface area

## Out of Scope

- Deep-linking to the comment field (not possible without eBird cooperation)
- Any form of auto-paste or clipboard integration beyond what already exists
- Modifying the formatted output text

## Risk

None. This is a static link constructed from data already in the app. No new API calls, no new state, no new error surface.
