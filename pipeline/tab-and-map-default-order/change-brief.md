# Change Brief — Tab and Map Default Order

## What is changing
New/default tab order becomes: Weather, Statistics, Species Detail, Map Explorer, Checklists, Multimedia, Breeding Codes, List Comparer, Named Birds, Settings. The List Comparer opens on checklist comparison by default, with Checklists on the left side of its mode selector. Map Explorer shows Nearby Lifers before Media Targets in the mode buttons.

## Why now
The current defaults no longer match how the user wants to move through SnowRaven day to day.

## User-facing impact
Existing saved custom tab layouts should keep working. New installs, reset layouts, and missing-tab normalization use the new order. The visible selector/button order changes on List Comparer and Map Explorer.

## Decisions touched
The tab-layout persistence decision stays intact: preferences continue through the storage seam, and this only changes defaults/normalization.

## What done looks like
The relevant tests lock the new default tab order and List Comparer default. A focused frontend test run passes, and the Map Explorer mode buttons render Nearby Lifers before Media Targets.
