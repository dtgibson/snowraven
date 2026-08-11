# Change Brief — center-share-latch

## What is changing

`MapExplorer`'s `centerShareOpen` flag stays `true` when the search centre is
cleared while the copy popup is open. The popup itself is gated on
`centerShareShown = centerPinShown && centerShareOpen` (`MapExplorer.tsx:2101`),
so clearing a coordinate unmounts it without routing through `closeCenterShare`
and the flag is left set with nothing on screen. The next time a valid centre
arrives, from any route, the popup springs back open on its own. This build
clears the flag on that same edge, using the render-adjustment shape already
shipped two lines away for the view-mode axis (`shareViewMode`,
`MapExplorer.tsx:255-258`): a bare `setCenterShareOpen(false)`, no new effect.

## Why now

Found by the v0.5.84 `uniform-map-fabs` security review (finding 8,
Informational, **Accepted**, `pipeline/uniform-map-fabs/security-report.md:173`)
and parked as an idea. Nothing forced it then and nothing forces it now, but the
seed idea's summary is **half wrong** and that changed the scope: it says
"nothing is visibly wrong today", while the report it came from says the popup
"re-mounts unbidden". The report is right. Verified independently here against
the shipped code with four probes rather than by reading (below).

## User-facing impact

**Yes — one real, narrow effect, contrary to the seed idea.** Open the popup on
Hotspots / Nearby Lifers / Media Targets, clear the Latitude or Longitude field
(popup disappears), then set a centre again by any route — retyping, the
place-name search, Use my location, or a right-click drop. The popup opens by
itself. The drop case is the sharpest: `applyCenter` is documented at
`MapExplorer.tsx:218` as never touching share state so "a drop-to-search stays
visually identical to today (FR-16)", and with the latch set that stated
guarantee does not hold. Everything else the idea worried about is clean —
verified, not assumed (next section). No published sentence becomes true or
false; `docs/HELP.md:305` already describes the popup as opening on a press.

## Design pass

**Not needed — no visual change.** No new surface, no restyle, no token, no
copy. It changes *when* an existing popup appears, which is behaviour, and the
appearance it removes is one nobody designed. The three designed FAB states
(ready / open / no-centre) and their labels are untouched.

## Decisions touched

**None reversed.** Two upheld, and the brief exists partly to keep them that
way. *Uniform map FABs: a second route to the existing pin* (v0.5.84) settled
`aria-expanded` gated on `hasValidCenter`; probe P2 confirms that gate is
already truthful in the cleared state and it must stay exactly as shipped.
*Pin Share* (v0.5.80) sub-decision 4 settled that the popup is transient and
session-scoped and that copy is always an explicit press; a popup that reopens
on its own sits against that spirit, so this is a reinforcement.
The recorded Spool rule against `git checkout <path>` mid-spin was honoured
during scoping: source was snapshotted and restored from the snapshot.

## What done looks like

Clearing a coordinate with the popup open, then setting a centre again by any
route, leaves the popup closed until the user presses for it. Focus stays in the
field being edited. `aria-expanded`, the three FAB labels, FR-18's view-mode
clearing, the pan-first press, and `closeCenterShare`'s focus restore are all
byte-unchanged in behaviour, and the existing 89 tests across the four share
suites stay green. A new test fails on today's code and passes after.

---

## Evidence and scoping notes (for The Engineer, not part of the brief proper)

### What was measured, not reasoned about

Four probes were run against the shipped code using the `uniform-map-fabs` test
harness, then deleted. Results:

| Probe | Question | Result on shipped code |
|---|---|---|
| P1 | Does the popup reappear after clear then re-set? | **Yes** — reappears unbidden |
| P2 | Is `aria-expanded` ever a lie while cleared? | No — absent, `aria-disabled=true`, correct label |
| P3 | Does a view-mode change already clear the latch? | Yes — `shareViewMode` covers that axis |
| P4 | Where is focus when the centre is cleared mid-edit? | In the input being edited |

So of the four failure modes worth worrying about on this surface, exactly one
is live. The screen-reader state is honest, focus lands correctly, and no
overlay eats an Escape it should not — `SharePopup`'s capture-phase listener is
registered and removed with the component (`SharePopup.tsx:142-144`), so an
unmounted popup consumes nothing.

### The recorded remediation is wrong — do not follow it literally

`security-report.md:186` says: *"If the latch is ever addressed, route the
coordinate-cleared path through `closeCenterShare`."* **That introduces a worse
bug than the one it fixes.** `closeCenterShare` sets
`restoreCenterPinFocusRef.current = true`, and the effect keyed on
`centerShareOpen` (`MapExplorer.tsx:237-247`) then moves focus to the opener.
Measured: with that remediation applied, backspacing the Latitude field to empty
throws focus out of the input and onto the FAB mid-typing (P4 fails, activeElement
becomes the `Set a search center to copy its location` button).

The correct form is a bare `setCenterShareOpen(false)` — which is exactly what
the shipped view-mode adjustment does, and for the same reason. With it, all
four probes pass and all 89 tests in `MapExplorerCenterShareFab`, `SharePopup`,
`SharePin` and `CenterPin` stay green.

Framed properly, the fix is **the missing half of an existing pattern**:
`centerPinShown = isCenterView && hasValidCenter`, and the shipped render
adjustment covers only the `isCenterView` factor. This build covers
`hasValidCenter`. It is not a new mechanism.

### Placement constraint

`hasValidCenter` is computed at `MapExplorer.tsx:2097`, far below the share
state block at 220-258. The tracking `useState` must be top-level with the other
hooks; the comparison `if` has to sit after `hasValidCenter` exists. Either
split the two, or lift the four centre-derived constants up to just after the
`lat`/`lng` state at 273. Engineer's call — worth a sentence either way, since a
reader will ask why the pair is separated.

### Testing posture

**No browser render is needed for this build.** Every claim is a DOM-identity or
attribute question that jsdom answers correctly, and all four were settled that
way above. The CLAUDE.md rule about geometry, cascade and accessible names being
invisible to jsdom does not bite here: nothing moves, no rule changes, no
accessible name changes. Do not stand up Playwright and the `SR_DATA_DIR` demo
dataset for this.

The new test must be written to **fail on today's code** — the existing suite is
green both with and without the fix, so it currently rejects nothing. P1 is the
shape to use. Worth adding P4 alongside it as the guard against the wrong
remediation, with the reason named in the test body, or the next person to read
the security report will "fix" it back.

### Regression risk

Low, but the surface is busy. Three overlays interact here (the share popup, the
mobile filters overlay, map fullscreen) and there is a documented Escape-ordering
contract: `SharePopup` binds Escape in the capture phase at `document` and calls
`stopPropagation` specifically so it beats `MapExplorer`'s bubble-phase
fullscreen-exit and sidebar-close handlers. This change touches none of that —
it adds one state transition on an edge where the popup is already unmounting —
but any drift toward "clean up the close paths" would.
