# Bug Brief - Honest Load-Failure Handling

## What is broken
SnowRaven collapses "no saved file" and "could not read file status" at three layers. Tauri metadata read failures and non-OK web status responses become empty status, while eight tab loaders turn a rejecting status read into setup-required guidance.

## Steps to reproduce
1. Make `/settings/files` return a non-OK response on web/Pi, or make Tauri's metadata document unreadable.
2. Open Statistics, Calendar, Checklists, Breeding Codes, Named Birds, Species Detail, Map Explorer, or Multimedia.
3. Observe setup instructions claiming no backup or export is saved.
4. Compare Weather Backlog or Search, which already report the same rejecting status read as a load failure.

## Expected behavior
An actually absent file still shows setup guidance. A failed status read stays distinguishable at the storage seam and every consumer reports the appropriate existing load-failure message without claiming the file is absent.

## Blast radius
The two storage adapters and the eight stored-file tab loaders are in scope, plus direct regression coverage at both seams and across the full tab roster. File contents, parsers, uploads, authentication, network destinations, backend routes, and visual design are unchanged.

## What done looks like
Missing metadata and an explicit empty status still produce setup guidance; corrupt or unreadable metadata, non-OK web responses, and rejected status reads produce the terse error state. Focused tests, the related load-failure family, typecheck, lint, and the production build pass.
