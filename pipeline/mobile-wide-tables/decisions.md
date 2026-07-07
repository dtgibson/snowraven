# Decisions — mobile-wide-tables (Stage 4, The Designer)

## Design-system deviations
**None.** This feature reuses the existing Breeding Codes matrix styling and the
established `--sr-*` token palette. Zero new tokens, zero new patterns, zero
deviations from `pipeline/design-system.md`. The only change is a column-width
value at the ≤640 phone tier (44px → ~30px), lifted to a CSS class per the
standing responsive convention. Fidelity was the priority and it holds — the
mockup renders with the real token values in both themes (verified: tier-4 dot
`#3B0764` light / `#6B21A8` dark; accent `#277448` / `#34D399`).

## Design calls made this stage (traceable, not deviations)

1. **Code-header treatment = horizontal terse code at 0.625rem (recommended).**
   Rotated (vertical) headers considered and reserved as an on-device-only
   fallback if a real code overflows 30px; dot-only (legend-only) header rejected
   because it strands per-column sort and the column↔code identity. Rationale:
   eBird codes are 1–3 chars and fit at 30px; horizontal is the most faithful,
   biggest tap target, no sticky-corner alignment risk.

2. **−/Fit/+ fallback control = hidden by default (recommended).** Native pinch
   alone by default; the control ships only on a QA-11 (on-device) failure,
   iOS-only, as a conscious re-scope. Recorded here because "show it by default on
   iOS?" is an open call the user may overturn — it is a one-line flip.

Both are design recommendations surfaced for the user's Stage-4 review, not
locked; neither introduces a token, pattern, or dependency.
