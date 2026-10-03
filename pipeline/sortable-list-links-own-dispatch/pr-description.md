## sortable-list-links-own-dispatch

### What this does
In the Mac, Windows, iPhone and iPad apps, every app-drawn link that opens a page in the browser now sends its own URL to the opener when clicked and cancels the click, so the opener plugin's window-level listener no longer has to find the clicked anchor and read its `href` back from the live DOM. The shared link components own it (`OutboundLink` and through it `HotspotLink`, `ChecklistLink`, the `SpeciesLinks` marks, `CommentText`), the seven hand-written `target="_blank"` anchors carry it in place, and a new AST guard fails any new-tab link added without it. Web and Pi keep ordinary anchors, and the rendered markup is byte-identical.

### How to test
1. `cd frontend && npx vitest run src/components/WeatherTabLinks.test.tsx src/components/SpeciesDetailChecklistFrequency.test.tsx src/components/OutboundLink.test.tsx src/components/ChecklistLink.test.tsx src/components/SpeciesLinks.test.tsx src/components/CommentText.test.tsx src/components/LifeListTable.test.tsx src/components/targets/Targets.test.tsx src/lib/openExternal.test.ts src/lib/newTabLinkDispatch.test.ts src/components/WeatherBacklogNativeActions.test.tsx`
2. All pass. The rows install `src/test/tauriOpener.ts`, a jsdom double of the Tauri IPC seam plus a replica of the opener plugin's listener, and check that each click opened once, by the link itself (`via: 'own'`), with the anchor's resolved href.
3. Manually, in the desktop app (`npm run desktop:dev` from the repo root): open Targets, sort by Distance, click a Last report place, sort by A to Z, click the same species' place again. Both open that species' hotspot page in the browser, once each.
4. `npm run typecheck`, `npm run lint`, `npm run build`.

### Notes for reviewer
- **The handler** is `openNewTabLink(event, href)` in `lib/openExternal.ts`. It sends `new URL(href, document.baseURI).href`, the string the anchor's `href` getter returns and the listener sent before, so a user-written comment URL (mixed-case or non-ASCII host, backslash, braces) and a query `'` reach the browser unchanged from today. It leaves an unparseable or non-http(s) URL alone. The click gate and the web/Pi no-op are `openExternalLink`'s (v1.0.28), unchanged.
- **The URL comes from the render the user clicked** (the closure), not from the anchor at click time, so a capture-phase ancestor that redraws the row with `flushSync` cannot change it. `OutboundLink.test.tsx` has the redraw row, with a bare-anchor control that the listener opens on the wrong row.
- **Caller first:** `OutboundLink` runs a caller's `onClick` before its own and skips a click the caller cancelled. Its `onClick` sits after `{...rest}`; attribute order is otherwise unchanged.
- **WeatherBacklog's `openChecklist` / `openEdit` are removed**, with `ChecklistLink`'s now-unused `onClick` prop. They duplicated the shared dispatch. `WeatherBacklogNativeActions.test.tsx` is unchanged and now exercises the shared owners (it goes red if `OutboundLink`'s handler is deleted).
- **The guard** (`lib/newTabLinkDispatch.test.ts`) also requires the handler to be given the element's own `href` expression and forbids a spread after the `onClick`. The hand-written sites hoist their URL into one `const` for that reason. Any other `_blank` literal in shipped source is reported; only `openExternalUrl`'s web path is permitted.
- **Byte-identical:** a before/after dump of 14 link scenarios (19 new-tab anchors) matched byte for byte, and the built CSS is identical to HEAD with the same hashes.
- **Security:** id-shape gates and `encodeURIComponent` unchanged; the same `plugin:opener|open_url` command gets the same string; no new host, endpoint or permission.
- **Known limitations:** maplibre's attribution links are library-drawn and stay on the listener; the two Weather tab links were lifted out of `App.tsx` into `components/WeatherTabLinks.tsx` (byte-identical markup) so they have runtime rows, as the Species Detail link does; `openExternal` moved from the entry chunk to the preloaded shared chunk (about 294 bytes net on first load); Enter is shown via the click a browser generates for it, since jsdom does not run keyboard activation. Details and mutation results in `pipeline/sortable-list-links-own-dispatch/decisions.md`.
- Not claimed: this does not explain the 1.0.28 Missing Weather collapse.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
