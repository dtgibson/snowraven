# Strategic Brief — eBird List Comparer

## What We're Building
A second tool within SnowRaven that compares two eBird backup CSV files and shows which species appear in both lists, only in the first, or only in the second. The existing standalone ebird-list-comparer codebase is the source of truth for all logic and components.

## Why Now
The list comparer already exists and works. The effort here is integration, not invention — porting proven frontend code into SnowRaven's component tree and deciding how the two tools coexist in the UI. Hosting both in one place eliminates a second deployment to maintain.

## The User Problem
A birder who regularly compares their life list against a friend's, or a historical backup against a current one, currently has to run a separate app to do it. Both tools live in different places, and maintaining two self-hosted apps is more friction than one.

## Success Criteria
- Drop two eBird CSV files, get a comparison instantly with no page reload or API call
- The three result panels (both, A only, B only) are scrollable and clear
- Navigating between the weather tool and the list comparer feels natural, not bolted-on
- All existing weather lookup behavior is unchanged

## Scope
- Port all logic and components from ebird-list-comparer into SnowRaven's frontend
- Add navigation between the two tools (tab bar or equivalent)
- Match SnowRaven's visual style (the comparer's own styling will be adapted, not kept as-is)
- No backend changes required — all comparison logic runs client-side

## Out of Scope
- Saving or persisting comparison results
- Comparing more than two lists at once
- Any modifications to the comparison logic itself
- Any new API integrations

## Key Decisions
- **Navigation model:** Two-tool navigation (tabs or a switcher) rather than stacking the comparer below the weather card. The results view is full-screen by nature and would be cramped below the card.
- **Style unification:** The comparer's existing Tailwind classes and component structure will be adapted to match SnowRaven's palette and shadcn setup — not kept as a visual island.
- **Source of truth:** The existing ebird-list-comparer logic (parseEbird.ts, compare.ts, types.ts) is ported as-is. No rewriting the comparison algorithm.
