# Strategic Brief - Subspecies Explorer

## What We're Building
A Subspecies Explorer on the Species Detail page: an option below the species selector that lists every species in the user's eBird backup with at least one subspecies-level entry, and a breakdown on any selected species showing how often each subspecies or form is reported versus the species as a whole, as a percentage.

## Why Now
The data is already loaded and half-surfaced: the "Show subspecies" toggle exposes exact-name entries, but it is an either/or view that resets the selection and never answers "which of my species carry subspecies detail" or "how often do I note the form." The v0.5.89 countability work gave the app a trusted, tested fold from form names to parent species, so the classification this feature needs already exists. It is fully offline over the user's own export, no API and no key, which is exactly the kind of feature the product exists to deliver.

## The User Problem
A birder who records subspecies (Oregon versus Slate-colored Junco, Myrtle versus Audubon's Warbler) can only see that effort one exact name at a time. There is no overview of which species have subspecies records, and no sense of proportion: do I note the form on 90% of my reports or 10%? The raw material sits in the backup CSV today with no view that reflects it back.

## Success Criteria
- From Species Detail, below the selector, the user can open a list of every species in their loaded data that has at least one subspecies/form entry, and picking one selects that species.
- For any selected species with form-level records, a breakdown shows each reported form with its report count and its percentage of the species' total reports, plus a row for reports made at plain species level, and the shares sum to 100%.
- The breakdown's totals agree with what the existing merged view aggregates for the same species.
- Everything works fully offline with no eBird key and zero network calls.
- A species with no form-level records shows an honest empty state, and the list omits it.
- Existing toggles, life-list counts, and every other tab behave exactly as before.

## Scope
- The list-all-species-with-subspecies option below the Species Detail selector, showing each qualifying species with its forms and share percentages, navigable to the species.
- A per-species subspecies breakdown section on the selected species' detail view, available in the default merged mode: per-form report counts, percentage of the species' reports, and an explicit "no form noted" row for species-level reports.
- Forms included: countable trailing-parenthetical entries that fold to a parent species (ISSF subspecies groups, intergrades, domestic types), per the Key Decision below.
- Pure offline computation from the already-parsed backup in memory.

## Out of Scope
- Hybrids, spuhs, slashes, and undescribed forms: non-countable names are not subspecies of a parent and do not appear in the explorer.
- Any eBird API use: no fetching the full subspecies taxonomy, no regional or expected-form data; only forms present in the user's own export appear.
- Changes to countability rules, life-list totals, or the behavior of the existing "Show subspecies" and "Show all forms" toggles.
- Subspecies views on other tabs (Statistics, Life List, Multimedia); this is a Species Detail feature for v1.
- Breaking the page's other sections (media, map, breeding codes) out by subspecies; the breakdown covers report share only.

## Key Decisions
- "Subspecies entry" means a raw observation name that folds to a different parent species AND is countable under eBird's rule (anything `isNonCountableForm` rejects is excluded). This includes ISSF subspecies groups, intergrades, and domestic types, and excludes hybrids, spuhs, slashes, and undescribed forms. FLAGGED for the Planner: a narrower pure-subspecies-only definition would require classification the current utilities do not provide; if the broader set stands, the UI labeling should say "subspecies and forms" honestly.
- Percentage basis: share of the parent species' observation rows in the backup (one CSV row is one report). Species-level rows count as "no form noted" and render as their own row so shares sum to 100%. Not individual bird counts, not checklists; a checklist carrying both a species-level and a form-level row contributes each row once.
- Fully offline from the loaded export: no new providers, no key requirement, no privacy-policy change. This is a hard constraint, not an optimization.
- Placement: Species Detail, below the selector, working in the default merged mode without requiring or altering the "Show subspecies" toggle.
- Alignment verdict: aligned with the founding brief. Own-data exploration, local-first, works alongside eBird without replacing it; nothing in the founding Out of Scope list is touched.
