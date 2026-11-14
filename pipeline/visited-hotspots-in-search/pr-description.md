## Visited Hotspots in Search

### What this does
Search (the Cmd-K / Ctrl-K overlay) gains a third group of results, **Locations**, after Destinations and Species: every place in the user's own eBird backup, public eBird hotspots and personal locations alike, matched on its name. Choosing one opens the Hotspot Reports tab on that place, from any tab, including from a fullscreen Map Explorer and when the tab is hidden. It ships in the FULL form (FR-33) of the brief's outcome ladder, re-measured in the built app in Chromium and WebKit against gates R1 to R5 (figures in `decisions.md`, "Stage 5, The Engineer").

### How it works
- `lib/paletteLocations.ts` derives a slim location index from the shared parse (a second derivation of the Hotspot Reports rule, measured equal to the tab's over a generated corpus), memoized in a `WeakMap` on the parse's identity so it is built at most once per file and released with it. The per-keystroke match is at most `LOCATION_CAP + 1` native searches over one flat lowercased column, whatever the file holds.
- `lib/paletteLocationsLoad.ts` holds the one timing decision: the derivation never runs in the task that commits the species answer, and never before the overlay's first frame. A file already derived joins with the species rows at no cost; otherwise the locations are derived in their own task after the next frame and join one frame after the species rows (E-08, the Guide's decision that no existing long task may get longer).
- `lib/paletteRows.ts` gains `buildSearchRows`, a wrapper that calls the shipped `buildPaletteRows` and appends; destinations and species rows are that function's output for every query.
- `CommandPalette.tsx` arms the location half only when `onOpenLocation` is passed (App always passes it), renders the two-line location row (DD-1), the narrow-field hint (DD-2), and each cap line inside its own group (DD-3).
- `App.tsx` adds a single-use `requestedLocation`, the species route's shape line for line; `HotspotReportsTab.tsx` consumes it once its phase has settled for the current file, as a picker selection.
- Help's Search, Default Files and Hotspot Reports sections and `ACCESSIBILITY.md`'s arrow-key sentence are updated; `.claude/rules/security.md`, `ui.md` and `maps.md` gain their `paths` entries (`maps.md` also gains one sentence on wrapping a new embedded-map host in `MapTabShowingProvider`).

### How to test
1. `cd frontend && npm ci && npm run build`, then serve it: `cd backend && uvicorn main:app --port 1620` (or `npm run desktop:dev` for the Mac app).
2. With an eBird backup saved, press Ctrl-K (Cmd-K on a Mac) and type part of a place name you have birded, for example `park`.
3. A **Locations** group appears below Species. Each row shows the place's name and, beneath it, its county and state; two places with the same name and county show their Location IDs.
4. Choose one (click, or arrow down to it and press Enter): Search closes and Hotspot Reports opens on that place's report.
5. Try it from a fullscreen Map Explorer, and with Hotspot Reports hidden in Settings: the report still opens.
6. Type `a`: both Species and Locations stop at 50 rows, each with its own line saying so.

### Notes for reviewer
- **Ship gate**: every gate figure re-measured in the built app is in `decisions.md`. No gate number was changed.
- **Locations join one frame after species on a first open** (E-08): when Search is opened before the backup has been read, the species answer's task is now the base build's length and the location derivation is a separate task of about 8 to 12 ms after the next frame. This overrides FR-33's "same update" for that case by the Guide's decision.
- **An expanded embedded map is released when its tab is left** (E-09, QA-28): the fullscreen of the Species Detail, Statistics and Named Birds maps is now tied to its tab showing, through a `MapTabShowingProvider` App puts around those three panels. Choosing a result in Search from an expanded map no longer leaves the page scroll-locked or the map expanded on return. This also repairs a shipped defect: the species route from Statistics' or a Named Birds card's expanded map left the page locked in the shipped app (before/after table in `decisions.md`, "QA-28, re-measured").
- **A replaced or cleared backup never comes back through a waiting derivation** (E-10, security F-1): the overlay's deferred derivation checks a generation the files-epoch effect bumps at once, so a task the next frame queued before the reset rendered stores nothing. Three rows in `CommandPalette.locations.test.tsx` (clear, replace, and a control) hold it, red on the code before the fix.
- **Deviations from the schema, each recorded** in `decisions.md` (E-01 to E-04): `SearchRow` widens `PaletteRow` instead of `PaletteRow` gaining a kind (an existing test narrows `PaletteRow` to `tab | species`); the species cap line moves inside its group only when the location half is armed (an existing row pins it after the listbox); the hint's phone floor is written as `16px` and compared to `--sr-ctl-floor` by a new guard (an existing guard holds every `--sr-*` in the palette section to the theme blocks); App-level route rows are structural, since no suite renders App.
- **Edited existing assertions**: the string pins `CommandPalette.test.tsx` (the no-backup sentence) and `HelpDocs.test.tsx` (the accessible name, two lines), plus, at QA fix errand 1, the pattern in `mapFullscreenWiring.test.tsx`'s "adds no fullscreen state to App.tsx" row (E-09; the reason is in `decisions.md`).
- **Bundle**: no module joins App's static graph; the entry chunk grows by the new strings and App's two callbacks. Opening Search now also loads two shared chunks the Hotspot Reports and Life Lists tabs already use (schema section 7's stated cost).
- **No version bump, no published copy**: the What's New sentence is held in `held/whats-new.md` for the user's yes; README, website, App Store, privacy policy and F-Droid are untouched.

## Seeing Visited Hotspots in Search locally

1. Open a terminal in your project folder.
2. Start the app: `npm run desktop:dev` (the Mac app), or for the browser version run `cd backend && uvicorn main:app --reload --port 1620` in one terminal and `cd frontend && npm run dev` in another.
3. For the browser version, open http://localhost:5173 (the Mac app opens its own window).
4. Make sure your eBird backup is saved (Settings, Default Files, eBird Backup). Then press Ctrl-K (Cmd-K on a Mac), or click **Search** at the top of the navigation.
5. Type part of the name of a place you have birded. Below the birds you will see a **Locations** list with each place's county and state underneath. Click one: Search closes and the Hotspot Reports tab shows that place's report.
