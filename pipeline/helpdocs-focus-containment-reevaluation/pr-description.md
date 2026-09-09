## HelpDocs focus containment re-evaluation

### What this does

Makes the existing Documentation dialog contain focus whenever it is open, including focus moved directly toward covered app controls. It also gives Documentation ownership of Escape over the still-mounted Welcome screen while preserving Search as the higher modal and preserving opener restoration for every close route.

### How to test

1. From `frontend/`, run `npx vitest run src/components/HelpDocs.test.tsx`.
2. Confirm the suite covers direct outside focus, forward and reverse Tab wrapping, Search above Documentation, and both Close and Escape from Welcome and ordinary app origins.
3. Run the focused neighboring focus suites, changed-file lint, typecheck, and production build listed in `how-to-see.md`.
4. Run `node pipeline/helpdocs-focus-containment-reevaluation/verify-helpdocs-focus.mjs` from the project root for the headless Chromium and WebKit matrix at desktop and phone sizes; no GUI session is required.

### Notes for reviewer

This is a narrow HelpDocs call-site change. `useFocusTrap` already supports containment and higher-trap ownership, so its implementation is unchanged. Help listens for Escape at document capture and stops propagation: the Search hotkey listener at window capture still runs first, while Welcome's document bubble listener no longer sees the same press.

There is no visual, copy, markup, tab-order, shared-selector, dependency, version, backend, website, or release change. The opener-restore cleanup remains compatible with containment because React detaches the Help root ref before passive cleanup runs, so the containment listener has no live root to pull focus back into.
