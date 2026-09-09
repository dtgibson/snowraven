# Change Brief — HelpDocs Focus Containment Re-evaluation

## What is changing
Treat HelpDocs as the always-modal surface its markup already declares: enable `containOutsideFocus` on its existing shared focus trap, and make its Escape route dismiss Help before the still-mounted Welcome dialog can consume the same key. Add focused App-shaped regressions for outside focus, stacked Search ownership, close/Escape restoration, and existing two-direction Tab wrapping. Correct the stale focus-rule prose and publish the resulting Help behavior; no shared selector or trap implementation change is expected.

## Why now
The v1.0.20 deferral rested on “no measured need,” while v1.0.25 has since removed the higher-modal blocker. Current production builds measured in Chromium and WebKit at 1280×800 and 390×844 show a full-viewport `aria-modal` dialog over a non-inert app: 30 current candidates wrap correctly in both Tab directions, but direct focus of the covered Welcome or footer control remains outside in all four runs. The same real App shape exposed a coupled restore failure: from Welcome, the first Escape dismisses Welcome underneath Help, then the second closes Help to `<body>` because its opener is gone.

## User-facing impact
Keyboard or assistive-technology focus can no longer remain on controls hidden behind Documentation. Search opened above Documentation still owns focus, and Help resumes containment when Search closes. From the cold-start Welcome screen, one Escape closes Documentation only and returns to **Read the documentation** instead of dismissing Welcome underneath and eventually dropping focus to the page body. No copy, layout, styling, control, or tab order changes.

## Design pass
Not needed — no visual change. This aligns focus and dismissal behavior with an existing full-window modal.

## Decisions touched
- **v1.0.15 — focus traps contain on `focusin`:** enforced for HelpDocs now that an outside-focus leak is measured; end wrapping remains the keydown arm's separate job.
- **v1.0.20 — selector consolidation / F061 correction:** the cleanup-timing correction remains true, but its “no measured need” HelpDocs deferral is superseded by current browser evidence.
- **v1.0.25 — most recently activated trap owns focus:** relied on, not changed; it makes Help containment compatible with Search and the contained Welcome screen.
- **Overlay close-path rule:** strengthened at this call site so the innermost modal owns Escape and opener restoration is not aimed at a detached lower-dialog control.

## Scope and exclusions
Expected production change: `frontend/src/components/HelpDocs.tsx`. Focused guards belong in `HelpDocs.test.tsx`, with published behavior in `ACCESSIBILITY.md` and stale focus guidance corrected in `.claude/rules/ui.md`. `lib/useFocusTrap.ts`, `WelcomeScreen.tsx`, `CommandPalette.tsx`, selectors, CSS, Help content/link parsing, backend, dependencies, manifests, versions, changelog, website, and release machinery are out of scope unless implementation evidence proves the narrow call-site fix cannot hold.

## What done looks like
Focus moved to a covered control returns inside Help without a Tab key; forward and reverse Tab still wrap through its buttons and links. A higher Search trap keeps focus and Help resumes after it closes. Close and Escape each remove only Help and restore its live opener from both Welcome and ordinary app state, never `<body>`. Focused tests discriminate containment, base trapping, and Escape ownership independently; production build and Chromium/WebKit desktop/phone checks pass.
