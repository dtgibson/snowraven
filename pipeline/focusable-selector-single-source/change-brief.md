# Change Brief — focusable-selector-single-source

## What is changing
Four production copies of `FOCUSABLE_SELECTOR` outside `lib/useFocusTrap.ts` — `WelcomeScreen.tsx:32`, `Calendar.tsx:573` (day dialog), `HelpDocs.tsx:337`, `MapExplorer.tsx:577` (mobile filters sidebar) — each hand-rolling a keydown-only trap, consolidate onto the shared hook. Two test-side copies (`Calendar.test.tsx:912`, `WelcomeScreen.test.tsx:13`) import the export instead. The Calendar day dialog additionally opts into `containOutsideFocus`, closing a real containment defect; MapExplorer opts in and keeps its own `offsetParent`/`[inert]` visibility filter layered on the shared selector, since `focusablesIn` does not filter for visibility and dropping that is a regression. WelcomeScreen opts in (opaque first-run takeover over a non-inert app). HelpDocs consolidates at the default `false` — see Impact. `ModalDialog`'s default is NOT flipped. `useFocusTrap.ts:44-47`'s stale roster count is corrected in the same pass.

## Why now
`DECISIONS.md` v1.0.16 records this exact defect as a repaired symptom over an intact cause: marking the Calendar dialog's Close button and checklist links made WebKit's real order match the predicted list, so containment now holds "by agreement, not by construction", and the entry says it is recorded loudly precisely because it will otherwise be forgotten. `ROADMAP.md:43` carries the four copies; `ROADMAP.md:68` item (2) defers the roster-count prose repair explicitly *to this build*, by name, because it collides with the file this build owns.

## User-facing impact
Keyboard-only, and only inside four overlays. Focus that escapes the Calendar day dialog, the Welcome takeover or the Map Explorer filters sidebar is pulled back after it lands rather than on the next Tab — the v1.0.15 fix, applied where it was missing. Nothing moves, nothing is restyled, and no control gains or loses a tab stop. **HelpDocs is a stated non-change:** its opener-restore runs in a cleanup of an effect defined *before* the trap effect, so at unmount the restore fires while a `focusin` listener would still be armed — the trap would yank focus into an overlay about to be removed and drop it to `<body>`, which is F061. It consolidates onto the shared selector and hook (rule satisfied, behaviour byte-identical) and opting it in is deferred until that restore moves post-commit.

## Design pass
Not needed — no visual change. Containment is behaviour: no layout, spacing, type, color or motion changes, and no surface gains or loses a control. The only perceptible difference is where a focus ring is allowed to land.

## Decisions touched
- **v1.0.15** (`focus trap must contain on focusin`) — enforced, not modified. Its "option-gated shared extraction owes a two-direction mutation check" clause binds every new opt-in here.
- **v1.0.16** (`A REPAIRED SYMPTOM OVER AN INTACT CAUSE`) — this build closes the cause that entry names. Its roster prose ("five rostered exceptions... three roving groups") is *corrected*, not reversed: `EXCLUSIONS` now holds 4 rows over 2 roving groups since the nav rework retired the collapsed-tab-bar listbox.
- **v1.0.19 Spool bundle** (`A COMMENT ABOUT A SHARED HOOK MUST DESCRIBE BEHAVIOUR AT THAT CALL SITE`) — upheld. `NavMoreSheet` and `CommandPalette` keep `containOutsideFocus` off and their comments untouched; both are measured F061 sites and are out of scope.
- No decision is reversed. `ACCESSIBILITY.md`'s three-item list is already correct (the 4th roster row is published separately under Offline States) and needs no edit.

## What done looks like
`grep` finds the selector string in `lib/useFocusTrap.ts` and nowhere else under `frontend/src` (the `website/tools/verify/verify-palette.mjs` copy stays: it runs inside `page.evaluate`, a browser context that cannot import from source). All four overlays trap via `useFocusTrap`; the Calendar dialog contains on `focusin` with a test asserting the property that makes the engine's tab order irrelevant — focus lands outside and is pulled back with no keydown — mutation-checked in both directions, per v1.0.15. MapExplorer's collapsed-accordion content is still excluded from its trap list. `npm run build` clean; `tabOrderCoverage.test.ts` unchanged and green.
