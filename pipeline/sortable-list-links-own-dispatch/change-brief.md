# Change Brief: Sortable list links own their dispatch

## What is changing
In the Mac, Windows, iPhone and iPad apps, every app-drawn link that opens a page in the browser will send its own URL to the opener when clicked. Today the opener plugin's window-level click listener finds the clicked anchor and reads its `href` back from the page.
- **Owners, so every use inherits it:** `OutboundLink` (and through it `HotspotLink`), `ChecklistLink`, the mark in `SpeciesLinks`, and the links in `CommentText`. Each calls the existing `openExternalLink` (v1.0.28) with the URL it already built from its validated id.
- **The seven hand-written new-tab links** (`LifeListTable.tsx` x4, `SpeciesDetail.tsx` x1, `App.tsx` x2) gain the same handler in place. Moving them onto `OutboundLink` would drop the tab-order guard's link population (14) under its floor (more than 10).
- A caller's own `onClick` runs first, and the shared handler skips an event the caller prevented, so nothing opens twice. `components/ui/Link.tsx` gains nothing. Web and Pi keep plain anchors.
- **Scope is wider than the idea's two components, on purpose.** A Targets row (the idea's own example) has three links: the eBird and Birds of the World marks and the hotspot. Multimedia's sortable table hand-writes four per row. Fixing two components would leave most links in sortable lists on the listener.
- Security is unchanged: the id-shape gates and `encodeURIComponent` stay. The same `plugin:opener|open_url` command, allowed by the existing `opener:default`, receives the same URL. No new host or endpoint, and no request moves between components.

## Why now
The user queued this idea. v1.0.47 (security F2) accepted the listener for shared links and left row-owned dispatch as an open idea. This build is the deliberate exercise of that idea, not a fix for an observed defect.
The listener works today. It reads the anchor actually clicked, the lists checked key rows by stable ids (Targets by species code), and no shared link sits in a row with its own click handler. But that correctness rests on two unguarded conventions: stable keys, and no click handler that re-renders the row before the window listener runs. Row-owned dispatch sends the URL from the render the user clicked, whatever a caller does later.
It also makes two CLAUDE.md instructions agree (the v1.0.28 rule and the v1.0.47 carve-out). The Auditor flagged that the two pull in different directions.
**Not claimed:** this build does not explain or fix the 1.0.28 Missing Weather collapse. That report also hit Copy weather & go, which never used the listener.
**Why build, not decline:** the v1.0.19 and v1.0.20 declines faced hundreds of controls and a primitive with nothing to own. This build reuses a tested helper at eleven sites, with no change to markup or behavior.

## User-facing impact
None. The links, the look, the accessible names and the pages they open stay the same.
A click, Enter on a focused link, Ctrl-click and Shift-click still open the page in the browser. Cmd-click, Alt-click, middle-click and right-click behave as before.
Web and Pi are untouched, so Cmd-click there still opens a background tab.
The rendered markup is byte-identical, because a React click handler adds no attribute.

## Design pass
Not needed. Nothing visual changes.

## Decisions touched
- **DECISIONS.md v1.0.47 (targets-hotspot-link, security F2): MODIFIED.** "Row-owned dispatch accepted, not applied" becomes applied to every shared and hand-written new-tab link. The trigger is the user's choice to build, not its reversal condition (no new failure has been observed). The Chronicler rewrites CLAUDE.md's "Opening an external URL from code" bullet and the `ui.md` link bullets into one rule.
- **v1.0.28 (stalled-reads-and-checklist-links): extended, unchanged.** `openExternalLink` and its gate are reused as they are. The header of `lib/openExternal.ts` ("use OutboundLink / ChecklistLink for a link the user clicks") gets updated.
- **v1.0.24 (shared Button/Link primitives): relied on.** `Link` stays free of behavior, so the handler lives in the components that own each link.
- **v1.0.47's HotspotLink layout and `HotspotLink.unchanged.fixture.json`: unchanged.**
- **Spin rules:** no version bump, no CHANGELOG.md, and no edits to the website, README, App Store or privacy policy. The Engineer writes `pipeline/sortable-list-links-own-dispatch/changelog-line.md`.

## What done looks like
1. **Tauri-mode tests for each owner and each hand-written site:** one click calls the opener once with that row's exact URL and prevents the default. A replica of the plugin's window listener, installed in the test, opens nothing more.
2. **Targets table test:** re-sort between clicks, and each click opens the clicked row's hotspot. A click whose ancestor re-renders the row inside the same click (`flushSync`) still opens the URL that was clicked.
3. **Nothing regresses:** web and Pi clicks are not prevented and invoke nothing. Cmd, Alt, non-primary and already-prevented clicks are left alone. Ctrl and Shift clicks dispatch. Enter opens once.
4. **The URL sent equals the anchor's resolved `href`** (what the listener sends today), including user comment URL shapes in `CommentText`.
5. **A new AST guard:** every element with `target="_blank"` in shipped source carries the handler. It is mutation-checked by removing one handler.
6. **These stay green:** `tabOrderCoverage.test.ts`, `entryChunk.test.ts` (`openExternal.ts` is already on the entry graph through `WeatherBacklog`), the HotspotLink markup fixture, `WeatherBacklogNativeActions.test.tsx`, typecheck, lint and build.
