# Change Brief — docs-ml-export-and-ordering

## What is changing
Two documentation improvements, no code changes:
1. **ML export instructions (HELP.md, and any README echo):** add two specifics to the download steps — on the Macaulay Library *My Media* page, set the media filter to **All** (not just Birds) before saving, and **leave the exported filename unchanged** when uploading it to SnowRaven.
2. **Completeness & ordering audit of README.md and docs/HELP.md:** verify every current tab/feature is documented and up-to-date, and that the per-tab sections in both docs follow the app's default tab order (Weather → Species Detail → Statistics → Map Explorer → Media List → Breeding Codes → Life List Comparer → Settings). Fix any gaps, stale text, or misordering found.

## Why now
The ML export steps omit the "All media" filter (a user who leaves it on Birds gets an incomplete export) and don't warn against renaming the file — which silently breaks the personalized Macaulay Library links, since `parseMLUserId()` in `LifeList.tsx` extracts the user ID from the default filename (`/^ML__.*_([A-Za-z0-9]+)\.csv$/`). After a run of features (responsive nav, Windows app, Windows geolocation), it's also worth confirming the docs are complete and consistently ordered.

## User-facing impact
None in the app. Documentation only.

## Decisions touched
None.

## Key facts for the Engineer
- ML export download instructions live in `docs/HELP.md` (### ML export, ~line 66–72). README references ML export in the Tools/Media List/Settings sections but has no separate download how-to; check whether a brief echo of the filter/filename note belongs in README's Media List usage steps.
- Default tab order is in `frontend/src/lib/tabLayout.ts` → `DEFAULT_TAB_ORDER`: weather, species-detail, birding-stats (Statistics), map-explorer, life-list (Media List), breeding-codes, comparer (Life List Comparer); Settings always last.
- Current state (verified at scoping): README "Tools" section and HELP per-tab sections already appear to follow this order — confirm section-by-section and fix only if something is off.
- The filename matters because `parseMLUserId` expects the default `ML__..._<userid>.csv` pattern; a renamed file → null user ID → media links lose `&userId=` personalization.

## What done looks like
- The ML export section states the **All** media filter and the **don't rename the file** guidance, with the reason briefly noted.
- README and HELP confirmed complete (all current tabs/features present, no stale claims) and ordered to match the default tab order; any discrepancies fixed.
- No code or behavior changes; nothing edited beyond the two docs.
