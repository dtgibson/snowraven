# Decisions: Species Detail Escapee Toggle

## Design stage (The Designer, Improve lane, Stage 2)

1. **Label: `Show escapees`.** The tab's verb family is "Show" (rows move;
   `countabilityCopy.ts`), the noun is `Count escapees`'s so the two tabs read as
   one rule in two verbs (the `Count all forms` / `Show all forms` pattern),
   positive, non-enumerating, no attribution in the label (made once in the
   Statistics rule line). Rejected: `Show eBird escapees`, `Include escapees`,
   `Count escapees` on this tab. Home: `SHOW_ESCAPEES_TOGGLE_LABEL` in
   `lib/exoticCopy.ts` (SpeciesDetail is lazy, so the lazy copy module is right).

2. **No rule note and no `ExoticProvenanceAccount` panel on this tab.** DECISIONS
   v0.5.89 decision 4 applied: the toggle is the interactive account. The
   Calendar's `.sr-count-rule-note` exists because the Calendar has no escapee
   control of its own, so without the sentence the rule would be invisible
   there; here the control is on the row and its label names the class it
   governs. A note under the toolbar would sit between the row and the hero
   selector on every visit after a Statistics pass, restating what the switch
   already says. The evidence (which species, how many checklists) lives on
   Statistics, one tab away, and that list links each name back here (the
   change-brief's OQ1 reveal). **Named cost, accepted:** a birder who has never
   visited Statistics sees a switch that changes nothing (an empty set is a
   no-op), and nothing on this tab says why. The rule is stated where the check
   is initiated, and this switch is the same shape as `Show all forms`, which
   likewise carries no note.

3. **Order: Show subspecies, Show all forms, Show escapees.** The merge control
   stays first (`countabilityCopy.ts`); the two reveal toggles on the
   countability axis sit together, with the newest last.

4. **`aria-live="polite"` on the "N species" span.** Parity with Multimedia's
   count span (`LifeList.tsx`), and the design system's "live counts
   aria-live=polite" commitment. The text changes only when the number does, so
   a no-op press announces nothing.

5. **Deviation, logged, CONFIRMED by the user at the design gate (2026-09-04): a hover state on the
   boxed `ToggleSwitch`, app-wide.** The doctrine's "hover/focus states set on
   purpose" is the specific reason; today the boxed variant has none. Treatment
   `--sr-border-medium` border + `--sr-surface-subtle` fill, 120ms ease-out.
   Mechanism: move the boxed variant's `border` and `background` from the inline
   style to a `sr-toggle` class rule in `globals.css` so `:hover` can win;
   nothing else in the component moves. It lands on every boxed switch
   (Species Detail, Multimedia, Map Explorer, Settings). The user confirmed it, along with the
   `Show escapees` label and the no-note decision, so The Engineer builds it.

6. **Design-system status: extended within the system.** No new token, no new
   component, no new pattern, no new phone-tier rule: the existing `.sr-ctl-row`
   guard (`max(16px, 0.75rem)`) reaches the third switch as a descendant. Item 5
   is the only proposed change to shared chrome.

7. **Measured, not assumed (headless Chromium over the mockup's copy of the
   shipped declarations):** 760px column: 1 line at 100%, 2 at 200%; 592px
   column (640 viewport, phone tier, 16px): 2 lines at 100% and at 200%; 272px
   column (320 viewport) at 200% (24px): 4 lines, one switch per line, the count
   on its own line at the right edge. Zero horizontal overflow and zero clipped
   labels in every case. Observed and left alone: the boxed switch is 30px tall
   on phones (no `.sr-touch-target`), today's shipped posture for all three.

## Deploy stage (The Deployer, Improve lane, Stage 6)

8. **App Store leg: HOLD (2026-09-04, user decision at the deploy gate).** 1.0.18
   is not submitted for App Store review and does not replace 1.0.17, which
   stays in Apple's queue as submitted this morning. Reason: the standing rule
   that opt-in polish does not replace an in-review submission (precedent: the
   v1.0.2 hold and the v1.0.5 pass). Withdrawing 1.0.17 to swap in 1.0.18 would
   surrender the queue position for a change that is off by default and reads
   the same as 1.0.17 until the switch is pressed. 1.0.18 reaches the store as
   an ordinary update after 1.0.17's approval; its TestFlight build 1
   (`1.0.18.1`, Delivery UUID `9f3195d4-8ca9-48d4-b4fb-93e48b069698`) is
   already uploaded and VALID, so that later submission is a metadata action
   only (select the build, review notes verbatim from `appstore/REVIEW_NOTES.md`,
   submit through the `reviewSubmissions` flow with the metadata key
   `QJA25M7XHM`). Nothing was created or withdrawn in App Store Connect on
   this ship. This satisfies the CLAUDE.md release-rhythm check: the App Store
   leg was verified against App Store Connect and its deferral is a written
   decision with a reason, not a silence.

   App Store version records at ship time, read from the ASC API
   (`GET /v1/apps/6787719977/appStoreVersions`, 2026-09-04 18:36 PDT, after the
   TestFlight upload):

   | Version | appStoreState | Note |
   |---|---|---|
   | 1.0.17 | WAITING_FOR_REVIEW | submitted 2026-09-04 morning; unchanged by this ship |
   | 1.0.14 | READY_FOR_SALE | the live store version |
   | 1.0.13 | READY_FOR_SALE | historical |
   | 1.0.4 | READY_FOR_SALE | historical |
   | 1.0.18 | no record | deliberately deferred; TestFlight build 1.0.18.1 VALID |

   1.0.15 and 1.0.16 never had a version record (the v1.0.17 post-mortem);
   1.0.17 supersedes them in the queue and 1.0.18 will supersede 1.0.17 as an
   update once it is approved.
