# Change Brief — Freezable Label Rows

## What is changing

Two halves of one saved idea, which investigation showed are **not equally settled** and should be gated separately.

**Half A — pin ON by default on phones (Breeding Codes).** Seed `pinned` from `useIsPhone()` at ≤640 instead of `false`. The catch is structural: the `pinned implies Unbounded` invariant is load-bearing (v0.5.81 settled that Normal view has no viable height unit at 200% text scale), so defaulting the pin **necessarily defaults the view**. On a phone the tab would open in Unbounded, which at ≤640 is a ~540px `table-layout: fixed` table in a `min-content` card — the **page scrolls horizontally at 320px**, and the sticky species-name column is dropped (`BreedingCodeTable.tsx:251, :324` apply `left: 0` in Normal only). Net trade: gain a pinned code header, lose the frozen bird name. Scoped as a per-breakpoint initial value only, **not** a persisted setting (see Impact).

**Half B — bring the media list to parity.** "The media list" is the **Multimedia** tab (`life-list` id, label "Multimedia", `LifeList.tsx` → `LifeListTable.tsx`, sole consumer). It is structurally comparable: same two views, wideMode sets no `overflow` so the scrollport is the page. It **already pins its header in wideMode** (`LifeListTable.tsx:234`) — but on the `<tr>`, which per this repo's own recorded finding WKWebView does not honor, and SnowRaven ships in WKWebView on macOS and iOS. So the existing pin is very likely **dead in the shipped desktop and iOS apps** and alive only in Chromium (web, Windows WebView2). It is also inline at (1,0,0) so no `.sr-ios-app` safe-area gate can reach it, and it carries no `scroll-margin-top` focus guard (WCAG 2.2 SC 2.4.11 — the exact defect the v0.5.81 security review caught). Parity work: port the `<th>`-level sticky, the iOS gate, the focus guard, and the opt-in pill.

**Not changing:** the capped-height frozen-header box stays reverted in both surfaces; the media data model; sort/filter; `LifeListTable`'s columns; any backend route, provider, or bundled dataset.

## Why now

The user's saved idea, verbatim: *"Make freeze label rows the default setting on mobile, and make the media list match the breeding code list with the freezable label row."* Pulled from the build queue as a Spool build. Half B additionally repairs a latent defect nobody has reported: the Multimedia sticky header has been on `<tr>` since v0.0.29, and the v0.5.56 pass that narrowed it to wideMode-only correctly removed the inert Normal-path copy but did not question the mechanism against WKWebView.

## User-facing impact

Real on both halves, and larger on Half A than the idea's wording suggests.

- **Half A:** on a phone the Breeding Codes tab opens in a different view than it does today — horizontally page-scrolling, no frozen species-name column. A user who wanted "labels frozen" gets the code header pinned but the bird name scrolling away sideways, which may be a net downgrade for the question they were actually asking. Desktop is untouched. Because tabs stay mounted, the default latches at **first open per app session**: a desktop window narrowed below 640px when the tab is first opened stays pinned and Unbounded for the rest of the session even after widening.
- **Half B:** WKWebView users (macOS app, iOS) gain a header pin that has never worked for them. Chromium users already have one — so if parity is implemented as an opt-in pill defaulted OFF, that is a visible **regression** for them. That knot is a design call, named below.
- **Persistence is deliberately out of scope.** "Default setting" could mean a real saved preference, but that means a new Settings control plus storage-seam state, and it reverses the deliberate session-only choice that matches `wideMode` beside it. That is a new capability, not a refinement. Flagged for the user rather than scoped here.

## Design pass

**Needed.** Both halves change how existing surfaces look and behave, and each carries an open call that is a design decision, not an engineering one.

Surfaces refined: the **Breeding Codes** matrix and its count-and-view control row, and the **Multimedia** table and its control row, at 320px and 200% in-app text scale, in both views.

Open calls for The Designer: (1) whether phone-Unbounded-with-a-pinned-header is genuinely the better phone default given it costs the frozen species-name column, or whether Half A should be declined; (2) whether Multimedia's pin becomes opt-in like Breeding Codes (regressing Chromium users) or stays always-on in Unbounded and is merely repaired; (3) fitting a third control into Multimedia's cluster, which already needed a `maxWidth: 100%` overflow repair in v0.5.82.

## Decisions touched

- **v0.5.81, "Breeding Codes pinned labels: v0.5.69 TOUCHED, NOT REVERSED"** — Half A **CONTRADICTS** it. That entry states the pin is "a user-chosen mode on top of it, **never something a user can land in**." Defaulting it on mobile is precisely landing in it. This needs the user's explicit ratification, not a quiet scoping. Half B **EXTENDS** the same entry's mechanism to a second surface.
- **v0.5.81 post-mortem, "Two defects in the pinned-labels work"** — binding on Half B: the `scroll-margin`-on-the-focus-target rule (the cell is not what receives focus; `BirdName` nests the button three levels in), and the settled prose phrasing "per-session, resetting on relaunch."
- **v0.5.69, "NOT a frozen-header data-grid"** — **NOT reversed by either half.** Neither reintroduces the capped-height box; the invariant keeps pinning to Unbounded, where it is free. Must stay not-reversed.
- **v0.5.70, unbounded-view column narrowing** — Half A promotes its ~540px phone-Unbounded shape from an opt-in view to the phone default.
- **v0.5.56, hover-only affordances for touch** — TOUCHED by Half B (the commit that narrowed the Multimedia sticky to wideMode).
- **v0.5.82, `.sr-wrap-flex` is inert without a width cap** — Multimedia's cluster gains a third control. Also a parity gap: its `↔ Unbounded` button lacks the `.sr-touch-target` Breeding Codes got in v0.5.81.
- **Session-only view-toggle precedent** (`wideMode`, Point Size v0.5.53, county Use Textures v0.5.51, Calendar view v0.5.62) — FOLLOWED. The persistence reading of Half A would break it.

## What done looks like

- Breeding Codes and Multimedia both keep the natural full-height page-scrolling table as the shipped default shape; no capped-height box appears anywhere.
- On Multimedia in Unbounded, the header row actually stays visible while scrolling **in the macOS app and on iOS**, not just in a Chromium browser, with the band clear of the Dynamic Island and keyboard focus never landing under it.
- Half A ships only if the live phone preview shows the pinned-header-without-a-frozen-name-column trade is genuinely better; the user reviews it on device before the ship gate.
- Existing suites pass unchanged for any user who does not turn a toggle on, and `npm run build` is clean.
