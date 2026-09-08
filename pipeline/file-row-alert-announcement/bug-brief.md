# Bug Brief — File Row Alert Announcement

## What is broken
Settings creates each FileRow `role="alert"` element carrying its first error message. Because the live region was not already present in the accessibility tree, assistive technology can miss the shipped CSV-only refusal and both export-hardening refusal messages.

## Steps to reproduce
1. Open Settings with either file row idle.
2. Capture the DOM before an upload and confirm that row has no alert region.
3. Upload a non-CSV file, an oversized CSV, or the wrong export for the row.
4. Observe that the alert element and its text arrive in the same render.

## Expected behavior
Each FileRow owns an always-mounted, empty alert region before an upload fails. A refusal inserts a sequence-keyed message child into that stable region, including when the same refusal happens twice.

## Blast radius
The production change is confined to FileRow in `Settings.tsx`; upload validation and copy do not change. Three broad `Settings.test.tsx` alert queries must target populated alerts, and focused tests must prove stable node identity plus repeat-message mutation for both file rows.

## What done looks like
The region exists empty before failure, stays the same DOM node when text arrives, and gets a fresh child for identical repeat refusals. Existing Settings and upload behavior, typechecking, linting, production build, and a served-app accessibility-tree check remain green.
