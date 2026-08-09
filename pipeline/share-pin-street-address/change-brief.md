# Change Brief — Share Pin Street Address

## What is changing

A secondary, user-pressed action in the share pin popup that looks up the nearest street address for the dropped point and offers it to copy. The existing copy control, its payload, and the Settings mode stay exactly as they are: the default path remains pure local string work with no request. Nothing is looked up until the user presses the new control.

Files that change: `frontend/src/components/map/SharePopup.tsx` (the control plus its loading, failure, offline, and no-address states), a new address-lookup module with its own cache, `backend/routers/nominatim.py` and `frontend/src/lib/tauri/nominatimService.ts` (twinned), `frontend/src/lib/transport.ts`, `globals.css`, and the prose files named below.

Files that do NOT change: `lib/shareLocation.ts` (its header contract says NO NETWORK and it must stay map-free, since Settings imports it and `entryChunk.test.ts` guards the maplibre chunk), `SharePin.tsx` (gesture, sprite, keyboard route, pin lifecycle), `shareCopyPreference.ts` and the Settings Sharing row, and the existing `/nominatim/counties` route and its LifeList caller.

## Why now

The user queued it as a saved idea. The apparent blocker is that v0.5.80 shipped this feature on a published "no lookup of any kind" promise, so this reads at first like a straight reversal.

It is narrower than that. The app **already** reverse-geocodes: `POST /nominatim/counties` calls `https://nominatim.openstreetmap.org/reverse` on both transports and reads `address.county` off the response, discarding the rest. A street address is other fields of that same response, from that same endpoint, at that same provider. `PRIVACY_POLICY.md` already discloses it ("to look up the county for a set of coordinates"). Both transports already serialize to 1 request/second with an identifying User-Agent, which matches Nominatim's policy; that policy permits a one-off reverse lookup tied to a user action and forbids only grid/systematic sweeps.

What genuinely changes is the coordinate **class**. Today's lookups are the user's own eBird checklist locations, already published to eBird. The share pin is an arbitrary dropped point, which the v0.5.80 decision explicitly framed as nest sites, stakeouts, and suppressed rare-bird locations.

## User-facing impact

Material, and this is the cost. Four published sentences become false as written and must be rewritten to scope the promise to the default copy rather than to the whole feature. "No lookup of any kind" becomes "the copy itself does no lookup; the address button asks OpenStreetMap, and only when you press it." That is a weaker promise, and a reader who trusted the strong one is entitled to notice. No wording recovers it.

Recommendation: build it as the on-demand secondary action the user asked for (option a). The v0.5.80 shortener rejection does not transfer: a shortener mints a permanent public URL resolving to the location and sits on the feature's central path, so it breaks the default flow offline. This mints nothing public, is never on the default path, and leaves the default's offline behavior untouched.

Rejected, per the alternatives considered: (c) "nearest place I have birded," computed offline from loaded data, does not answer the request. A hotspot name is not an address, the nearest one can be kilometers away, and it would be actively misleading for the stated purpose of directing someone to a parking pullout.

## Design pass

**Needed.** A control that sends a request must say so before it is pressed, and it lands in a popup whose compact variant is already at a documented geometry limit (roughly 8px of overflow on the 220px Named Birds card map, widening to 18px at 200% text scale, recorded in v0.5.80 as an accepted residual). Adding a second control plus a result line and four states (loading, failure, offline, no address found) to that body is a real layout and copy problem at both densities. ODbL attribution for the returned address also needs a home.

## Decisions touched

- **v0.5.80 "Pin Share: short canonical map URLs (never a shortener)"** — its sub-decision 1 rejects sending the coordinate to an outside company. This does not reverse it (that exclusion is about shorteners and permanent public URLs) but it does qualify the surrounding no-lookup framing, and the reversal must be recorded as such rather than filed as a refinement.
- **v0.5.80 "The Pin Share 'no outbound request' claim, stated accurately"** — its carry-forward formulation says the share action "issues no request on either transport." That sentence stops being true and needs restating.
- `docs/HELP.md:313` — "**Nothing is sent anywhere.** ... No shortener, no geocoder, no lookup of any kind, so the whole thing works with no connection."
- `README.md:16` — "the whole thing is assembled locally as plain text, so it works offline and no coordinate ever leaves your device."
- `website/index.html:319` — "no shortener, no lookup, nothing fetched, so it works with no connection and no coordinate leaves your device."
- `ROADMAP.md:11` — "No URL shortener and no lookup of any kind ... so the location never leaves it and the feature works with no connection."
- `PRIVACY_POLICY.md:33` — not false, but incomplete: its Nominatim clause needs a third use, and the repo rule requires the policy updated in the same change.
- `ACCESSIBILITY.md` — no sentence becomes false. Line 75 binds the new states: icon paired with text, never color alone, announced through a status or alert role.

## What done looks like

Pressing the new control returns a usable street address for the pin and copies it; the default copy path is byte-identical to today and still issues no request on either transport. Offline, and on a failed or empty lookup, the popup says plainly which it is and the default copy still works.

Binding constraints for whoever builds it: `transport.get` only, never raw fetch; the backend route and its `lib/tauri/` twin stay in lockstep; one caching layer per call, so the path stays out of `CACHED_GET_PATHS` if it carries its own cache (Nominatim's policy requires caching); no em dashes in user-facing copy; `.sr-*` tokens only; and the v0.5.80 conventions hold — the container-measured px cap, capture-phase Escape, and the sequence-keyed live region.
