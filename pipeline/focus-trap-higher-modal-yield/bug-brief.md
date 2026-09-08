# Bug Brief — Focus Trap Higher-Modal Yield

## What is broken
A `useFocusTrap` instance with `containOutsideFocus` treats focus inside a newly opened modal as an escape. Its `focusin` arm immediately pulls focus back underneath, and its keydown arm can do the same on the next Tab. This affects Cmd-K over embedded fullscreen, Calendar, and the Map Explorer sidebar, and prevents Welcome from safely enabling containment.

## Steps to reproduce
1. Open an overlay whose shared trap has `containOutsideFocus: true`.
2. Open Cmd-K or another modal above it and focus the upper modal's first control.
3. Observe the lower trap reclaim focus; if focus survives initially, press Tab and observe the lower keydown arm reclaim it.

## Expected behavior
The most recently activated trap owns focus while its modal is above another trap. Lower traps yield for both `focusin` and Tab, then resume their original containment immediately after the higher trap unmounts.

## Blast radius
The shared `useFocusTrap` hook, direct stacked-trap regression tests, Welcome's containment opt-in, and stale caller comments are in scope. Focusable selection, visibility filters, Escape layering, focus restoration, overlay layout, CSS, and modal copy are unchanged.

## What done looks like
Hook-level tests prove a higher trap keeps focus and Tab, a lower trap cannot steal either, and lower containment resumes after close. Existing fullscreen, Calendar, sidebar, Welcome, entry-chunk, typecheck, lint, and production-build checks remain green.
