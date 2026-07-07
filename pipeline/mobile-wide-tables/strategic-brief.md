# Strategic Brief — Mobile Breeding-Codes Matrix (Comfortable Phone View)

## What We're Building
A way for a birder to read and use their **full Breeding Codes matrix on a
phone comfortably** — the one genuinely-wide table in the app (a frozen
species column plus one ~44px column per breeding code, ~16 columns / ~1600px
on real data). Today it either scrolls sideways as a peephole or lurches the
whole page sideways in "Unbounded" mode; neither lets a phone user get a
comfortable read of their own codes.

The strategic bet, now settled with the user, is **minimal machinery on top of
native gestures**: (1) **narrow each breeding-code column to roughly the width
of its colored dot** — the columns are ~44px today ("very wide"), and shrinking
each to about its dot alone roughly *halves* the matrix width, so a full row
becomes far more scannable at a glance; and (2) lean on the **platform's own
native pinch-zoom** (the iOS/browser viewport pinch gesture) to magnify and pan,
rather than building custom zoom controls. Native viewport pinch is a *platform*
feature, categorically different from the CSS `zoom` / `transform: scale`
pixel-scaling that failed before. The target is both: full rows scannable at a
glance *and* comfortable pinch-to-magnify panning — with as little custom code
as we can get away with.

**This is a conscious reversal of a prior decision.** The same goal was built
once (as `ZoomableWideSurface`), iterated through ~7 on-device rounds, and
**reverted at the user's own explicit direction** on 2026-07-05 because the
scaling primitive it relied on — CSS `zoom` — does not reliably scale content
in the iOS WKWebView (the zoom % changed but the matrix didn't visibly shrink).
The `transform: scale()` primitive tried before it broke the frozen column.
Re-opening this is legitimate — the revert deferred a *technique*, not the goal
— but it only earns a fresh attempt if it commits to a **non-CSS-zoom,
non-transform-scale technique** and treats on-device WKWebView verification as a
hard gate. That is the load-bearing constraint of this whole feature.

## Why Now
The wide Breeding Codes matrix is the most-cited phone rough edge now that
SnowRaven has an iOS TestFlight build (0.5.68). The prior attempt closed by
explicitly deferring the technique, not abandoning the goal — the user is asking
again on the same phone-experience axis that opened it. What has changed since
the revert is both our understanding *and* our approach: we now know two
CSS scaling primitives (`transform: scale`, CSS `zoom`) both fail in WKWebView,
and instead of rediscovering that, we start from a fundamentally different
strategy — **shrink the matrix at the source (dot-width columns) and let the
platform's own pinch-zoom do the magnifying**. That combination sidesteps the
failed primitives entirely rather than substituting another custom scaling
mechanism.

## The User Problem
On a phone, a birder cannot get a comfortable, usable view of their own
breeding-code history. The matrix is far wider than any phone viewport, so the
current contained scroll shows a ~1-column peephole (the frozen name column eats
much of a 320–360px screen), while the "Unbounded" fallback scrolls the entire
app chrome sideways — an ugly, disorienting page-lurch. The user wants to see
and read their codes on the device they increasingly use, without fighting the
layout. The narrow viewport genuinely needs *some* wide/overview affordance; the
problem is that today's two options are a peephole and a lurch, with nothing
comfortable in between.

## Success Criteria
- On a phone, a birder can read their **full Breeding Codes matrix comfortably**:
  the code columns are narrowed to roughly dot-width so **full rows are scannable
  at a glance**, *and* they can **native-pinch to magnify and pan** around at a
  comfortable zoom — no whole-page sideways lurch.
- **Native pinch-zoom actually works in the app's iOS WKWebView**, confirmed
  on-device. This is the top risk (see below) and the user's verification step:
  Tauri/mobile apps commonly ship a viewport config that disables pinch, so the
  first thing to prove on real hardware is that the WebView *allows* the native
  gesture (and, if it doesn't, that it can be enabled without a `maximum-scale`
  clamp).
- **It works reliably in the iOS WKWebView, confirmed on-device.** Non-negotiable
  and owned by the user — jsdom cannot exercise pinch, scroll, or scaling, and the
  prior attempt's failure was invisible until real hardware. On-device WKWebView
  confirmation is a gate, not a nice-to-have.
- The treatment does **not** rely on CSS `zoom` or `transform: scale()` as a
  scaling primitive (both are proven WKWebView failures for this surface); it
  leans on the platform's native viewport pinch instead.
- Holds at **320px width and 200% in-app text scale**, with ~44px touch targets
  and `.sr-input-16` on any inputs — the standing mobile conventions.
- **Desktop and web table behavior is byte-unchanged.** Only the ≤640 phone tier
  renders differently; the desktop/tablet Breeding Codes table is untouched.
- The species-name links, breeding-code favicons, and per-cell affordances still
  work in the narrowed dot-width layout (the dot stays the tappable/legible unit;
  pinch-zoom brings any too-small detail up to a comfortable size).
- **Multimedia gets only minor phone polish, or nothing** — it already works well
  on mobile, so it is a light legibility/scroll ride-along at most, never a
  rebuild.

## Scope
- **PRIMARY — the Breeding Codes matrix** on the phone tier (≤640):
  `BreedingCodeTable.tsx` and its container `BreedingCodeList.tsx`. Narrow the
  code columns to roughly dot-width and enable/confirm native pinch-zoom on the
  wide surface.
- **SECONDARY — Multimedia** (`LifeListTable.tsx`): minor phone legibility/scroll
  polish only, or nothing at all — it already works well on mobile. A light
  ride-along, explicitly not a rebuild.
- **All phone-width (≤640), not iOS-only** — one code path for every small
  screen (web / Pi-on-a-phone included). Reuse the sanctioned
  `lib/useIsPhone.ts` `matchMedia` store for the phone-tier branch (already
  present; no new `window`/`resize` listeners).
- Whatever the treatment, it inherits the standing responsive + a11y conventions
  (`.sr-scroll-x`, sticky-header hygiene, `.sr-only` under `position:relative`,
  rem sizing).

## Out of Scope
- **CSS `zoom` and `transform: scale()` as the scaling primitive** — proven to
  fail in WKWebView for this surface (`zoom`) or to break the frozen column
  (`transform`). This attempt magnifies via native viewport pinch, not CSS
  scaling.
- **Reviving `ZoomableWideSurface` as-is** — the reverted component is a known
  dead end with its CSS-`zoom` mechanism. Its *goal* carries forward; its
  *implementation* does not.
- **Custom zoom controls / custom zoom UI** — deliberately out of the plan.
  Native pinch is the bet; custom zoom machinery is a *fallback only if* native
  pinch proves unworkable in the WKWebView, not part of the intended build.
- **A Multimedia rebuild** — Multimedia already works well on mobile; only minor
  legibility/scroll polish (or nothing) is in scope for it. Do not rearchitect it.
- **The Species Detail and List Comparer wide tables** — explicitly out. The
  wide-table pain being solved here is the Breeding Codes matrix.
- Desktop/tablet Breeding Codes rendering — unchanged.
- Any new `--sr-*` tokens beyond what the dot-width layout strictly needs (the
  prior design pass proved this is achievable with zero new tokens; keep that
  discipline as a default, not a hard rule).

## Key Decisions
- **Target experience = both "full rows at a glance" AND "pinch to magnify and
  pan"** — not an either/or. The dot-width column narrowing delivers the
  glance-scan; native pinch delivers the comfortable magnify-and-pan.
- **Native-pinch-first.** Prefer the platform's own native pinch-zoom over
  building any custom zoom controls — "perhaps we don't even need to build zoom
  controls if the user can natively pinch-and-zoom with iOS gestures." Custom
  zoom UI is a **fallback only if native pinch proves unworkable** in the
  WKWebView, not the plan. Native viewport pinch is a platform feature, wholly
  distinct from the reverted CSS-`zoom` / `transform: scale` pixel-scaling.
- **Narrow the Breeding-Codes columns to roughly dot-width.** They are ~44px
  today ("very wide"); shrinking each code column to about its colored dot alone
  roughly halves the matrix width and — combined with native pinch — is expected
  to deliver a comfortable full-row read with little machinery.
- **All phone-width (≤640), one code path** — not iOS-only. Every small screen
  (including web / Pi-on-a-phone) gets the same treatment.
- **Scope: Breeding Codes PRIMARY, Multimedia SECONDARY (minor).** Multimedia
  already works well on mobile → light polish or nothing. Species Detail and List
  Comparer wide tables are out.
- **This reverses a documented user decision** (`pipeline/mobile-app/decisions.md`,
  2026-07-05, "Wide-table phone zoom: ATTEMPTED then REVERTED"). The Chronicler
  should log the re-opening. The inherited constraint carries forward: CSS `zoom`
  is not dependable in WKWebView and `transform: scale` breaks the frozen sticky
  column — this attempt avoids both by leaning on native pinch + source-narrowed
  columns.
- **On-device WKWebView verification is a mandatory gate**, owned by the user.
  The last attempt looked correct in every automated check yet failed on the real
  WebView — so "green tests + a plausible approach" is not sufficient sign-off
  here.

## Top Risk to Carry into the Architect Stage
- **Does native pinch-zoom actually work — and is it enabled — in the app's iOS
  WKWebView?** This is the load-bearing must-verify-early. Tauri/mobile apps
  commonly ship a viewport config that *disables* pinch-zoom; if this app does,
  the whole native-pinch-first bet stalls until the viewport is corrected. The
  intent to preserve pinch already exists in the codebase — CLAUDE.md notes that
  `.sr-input-16` was chosen specifically to avoid a `maximum-scale` clamp that
  would kill pinch-zoom — but that intent must be *confirmed to actually hold* on
  the real iOS WebView before any UI is built on top of it. The Architect should
  make "prove native pinch works in the shipping WKWebView (and enable it without
  a `maximum-scale` clamp if it doesn't)" the first, gating spike — before
  committing to the dot-width layout as the sole magnify strategy.
