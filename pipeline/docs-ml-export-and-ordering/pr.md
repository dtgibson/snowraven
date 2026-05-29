## Docs: ML export instructions + completeness/ordering audit

### What this does
Documentation-only improvement. Clarifies the ML export steps and confirms README + HELP are complete, current, and in the app's default tab order.

### Changes
- **docs/HELP.md → ML export:** instruct users to set the My Media filter to **All** (not just Birds) before saving, and to **leave the downloaded filename unchanged** — with the reason (SnowRaven reads the Macaulay Library user ID from the filename to personalize media links; `parseMLUserId` expects the default `ML__..._<userid>.csv` pattern).
- **README.md → Media List "How it works":** brief echo of the same All-filter + don't-rename guidance, linking to HELP for full steps.
- **docs/HELP.md → Tab Layout:** added the responsive-dropdown behavior (shipped v0.3.29) that README already documented — closes a HELP completeness gap.
- **docs/HELP.md → Map Explorer location:** made the permission guidance platform-accurate (macOS *and* Windows, plus web), since Windows geolocation now ships.

### Audit result
- README "Tools" sections and HELP per-tab sections both already follow the default tab order (Weather → Species Detail → Statistics → Map Explorer → Media List → Breeding Codes → Life List Comparer → Settings) — verified section-by-section, no reordering needed.
- All current tabs/features are documented; the two gaps found (HELP responsive nav, mac-only location wording) are fixed.

### How to test
- Read docs/HELP.md "ML export" and "Tab Layout"; read README Media List step 1. Frontend build clean (HELP is bundled via `?raw`).

### Notes for reviewer
- No code or behavior changes. The filename guidance reflects real app behavior in `frontend/src/components/LifeList.tsx` (`parseMLUserId`).
