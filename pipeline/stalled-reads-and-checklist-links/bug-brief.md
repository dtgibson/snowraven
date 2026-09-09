# Bug Brief — Stalled Reads and Checklist Links

## What is broken
On web and Pi, a `/settings/files/ebird` request that never settles leaves the shared eBird load pending, so every dependent tab can spin for the rest of the session. Separately, the Weather tab's Missing Weather list can intermittently send every checklist, edit, and copy-and-go action to one checklist from the list until SnowRaven restarts.

## Steps to reproduce
1. On web or Pi, let the eBird file request connect without completing, then open any eBird-backed tab; later tabs join the same pending load and never recover.
2. With several no-weather checklists, expand Missing Weather and open actions from different rows repeatedly in one session; intermittently, distinct rows all land on one submission. The exact in-session trigger for this second symptom is not yet isolated.

## Expected behavior
Every stored-file request settles within a documented, evidence-based bound, releases the shared in-flight load on failure, and permits a clean retry. Every Missing Weather row always opens or looks up that row's own validated submission ID, across rerenders and on every supported app platform.

## Blast radius
The stalled read affects the shared eBird cache and every view built from it; the same transport pattern also exists for the ML export. The link defect is scoped first to all three Missing Weather row actions and the shared external-opening path; current unit coverage proves only isolated targets, not cross-row identity through repeated renders and native dispatch.

## What done looks like
A controlled never-settling fetch fails visibly within the bound, clears the shared promise, and a later call succeeds without restarting. Multi-row regression coverage and a real app check prove each visible action dispatches its own submission ID, with no cross-row collapse.
