# Decisions — County Lines & Shading

Deliberate deviations and choices for this feature, logged so they're explicit
and inheritable — not silent drift. The project design system
(`pipeline/design-system.md`) is otherwise unchanged at this stage.

---

## D-01 — New design-system token family: the green county choropleth ramp

**Stage:** 4 — The Designer (approved 2026-06-28)

**What:** Add a new sequential color ramp `--sr-county-1..4` (+ `-rgb` triplets)
to `frontend/src/globals.css`, declared **identically in both `:root` and
`[data-theme="dark"]`** (map-anchored — see Why). This is the choropleth fill
ramp for the County Lines & Shading overlay.

| Token | Value | RGB triplet | Reading |
|---|---|---|---|
| `--sr-county-1` | `#C3E8D1` | `195,232,209` | thinnest county list (lightest) |
| `--sr-county-2` | `#7FCB9E` | `127,203,158` | |
| `--sr-county-3` | `#3E9C66` | `62,156,102` | |
| `--sr-county-4` | `#1A5C38` | `26,92,56` | deepest county list (darkest; = `--sr-accent-strong` light) |

On-map fills use the solid color at `fill-opacity ~0.85`; tier 0 (unrecorded) is
`fill-opacity 0` (outline only) but stays hit-tested. Legend swatches use the
solid color with a `--sr-border-medium` border. Legend label text uses
`--sr-text` / `--sr-text-muted` (theme-flipping, AA). No on-fill map text exists,
so no on-fill text pair is added.

**Why a new ramp instead of reusing the existing `--sr-tier-1..4`:**

The PRD/schema (FR-11, FR-13, schema §3.2) literally say to map the choropleth
onto the existing `--sr-tier-N` ramp. We chose **not** to, and the user approved
the new ramp, for three reasons:

1. **`--sr-tier` is purple — it is semantically the Breeding-Atlas ramp.** A
   purple county choropleth would read as "breeding," and when the user has both
   overlays on (atlas blocks + county shading) the two purple polygon layers are
   nearly impossible to tell apart. The county overlay is explicitly designed to
   coexist with the atlas, so the ramps must be visually distinct.
2. **Cartographic correctness.** A magnitude choropleth ("how many species in this
   county?") calls for a single-hue sequential ramp. A dedicated green ramp is
   exactly that and is colorblind-reasonable as a monotonic light→dark sequence.
3. **Brand fit.** Green is SnowRaven's signature ("actionable or active"), and a
   deep county list is a positive, active reading. The ramp deepens toward
   `--sr-accent-strong`, tying it to the brand without colliding with the accent's
   interactive role (the accent is used for controls/links, not for fills).

**Why identical in both themes (not theme-flipped like `--sr-tier`):** the map
canvas is the always-light Positron basemap in both app themes, so the fills must
read against a light surface regardless of theme — the same posture already used
by `--sr-map-pin-*` and the rank/milestone on-map tokens. Theme-flipping the fills
would wash them out in dark mode over a light basemap. The surrounding chrome
(sidebar, popup, panel) keeps using the normal theme-flipping tokens.

**Cost / obligations:**
- One new token family in both theme blocks (the token rule: new tokens in BOTH
  themes before use — satisfied by the identical declarations).
- AA must be re-verified with the project's luminance math before shipping
  (NFR-07). The legend label text (`--sr-text` / `--sr-text-muted`) already passes;
  the swatch/fill carry no text. The mockup values were chosen to read clearly as
  a monotonic light→dark green sequence on the light basemap.
- This is a design-system extension. It is intentionally NOT folded into
  `pipeline/design-system.md` at this stage (that file is owned at the system
  level); it is logged here as the explicit record. If the county ramp proves
  reusable beyond this feature, promoting `--sr-county-*` into the design system's
  token list is a clean follow-up.

**Alternative kept on the table:** reverting to `--sr-tier` (purple) is a
one-line swap if the new ramp is ever rejected — the fill expression just
references `--sr-tier-N` instead of `--sr-county-N`. No other code depends on the
choice.

---

## D-02 — No hatch-texture toggle for the county choropleth

**What:** Unlike the atlas overlay (which offers a "Use Textures" sub-toggle with
per-tier hatch sprites), the county choropleth uses the flat sequential green ramp
as-is, with no textures option.

**Why:** Per the PRD ("Out of Scope": hatch textures), the single-hue green
sequence is already reasonably colorblind-readable as a monotonic light→dark
ramp, and omitting textures keeps the control simpler than the atlas. The atlas's
hatch mechanism remains available if a later iteration wants it. This is a
deliberate simplification, not an omission.

---

## D-03 — Contextual top-3 in the county popup (added during iteration)

**What:** The county popup carries, below the two headline counts, a contextual
top-3 list that **swaps with the active metric**: top-3 species (by record count)
in Species mode, top-3 locations (by checklist/record count) in Records mode;
an honest empty line for an unrecorded county.

**Why / implication:** Requested during design iteration and approved. It widens
the popup content but introduces no new pattern (top species via `<BirdName>`
semantics, top locations optionally via `HotspotLink`/`isPublicHotspot`).
**Data-model note for the Engineer:** `CountyAggregate` must now carry top-3
species and top-3 locations in addition to the species/records totals — both
derivable from the already-parsed backup with **zero new network calls** (rows
carry county, state, species, and location name/id). Fold the accumulation into
the planned `computeGeo` re-key (schema §2.3); use a bounded top-k, memoize with
the existing aggregate, no point-in-polygon. Captured here and in `design-spec.md`
(Interaction Notes).
