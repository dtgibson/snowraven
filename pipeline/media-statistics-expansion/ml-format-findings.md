# Verified ML export field formats (from a real export, 2077 assets)

Inspected `~/Documents/ML__2026-06-07T02-44_USER4741544.csv` (real export) with the
user's permission, Age/Sex + Behaviors + format checks only. These are the GROUND
TRUTH for the parser — they override the earlier assumptions.

## Age/Sex  (header `Age/Sex`, col 19) — ~92% populated (170 blank of 2077)
- Structure: one or more GROUPS joined by `"; "` (semicolon + space).
- Each group: `"<class> – <count>"` where the separator is a spaced **en-dash**
  `" – "` (U+2013), and `<count>` = number of individuals of that class.
- `<class>` is space-joined age and/or sex words:
  - age: `Adult` | `Immature` | `Juvenile` | (none)
  - sex: `Male` | `Female` | (none)
  - `Unknown` = unknown age (sex unspecified).
- Examples: `Adult – 1` · `Adult Male – 1` · `Adult Female – 1; Adult Male – 1`
  · `Adult – 1; Juvenile – 2` · `Unknown – 14` · `Male – 1` (sex known, age unspec).
- PARSE: split on `"; "` → each part `rsplit(" – ", 1)` → (classStr, N).
  classStr tokens: ageClass = first matching of {Adult,Immature,Juvenile} else
  (if 'Unknown') Unknown else (sex-only) Unknown-age; sex = Male/Female if present
  else Unknown. Weight buckets by N for a per-INDIVIDUAL mix (preferred), and also
  count assets for the annotation-rate stat. A literal `Unknown` (age) counts as
  NOT age-annotated; absence of a sex word counts as NOT sex-annotated.

## Behaviors  (header `Behaviors`, col 20) — ~34% populated (1371 blank of 2077)
- Multi-value joined by `"; "` (semicolon + space). DO NOT split on comma — labels
  themselves contain commas.
- Controlled vocabulary seen: `Flying`, `Foraging or Eating`, `Vocalizing`, `Song`,
  `Call`, `Preening, Scratching, or Bathing`, `Carrying Food`, `Nest Building`,
  `Feeding Young`, `Courtship, Display, or Copulation`, `Mechanical Sound`.
- Breeding-relevant subset for a tiered "breeding behaviors documented" stat:
  Confirmed-ish = Feeding Young, Carrying Food, Nest Building; Probable-ish =
  Courtship/Display/Copulation; Possible-ish = Song (singing in habitat).

## Average Community Rating (col 41) + Number of Ratings (col 42)
- Average: decimal 0–5, e.g. `5.00`, `4.67`, `4.80`, and `.00` (= 0, unrated).
  parseFloat handles leading-dot. Gate "rated" on Number of Ratings > 0.
- Number of Ratings: integer; THIS user 0–5 → library is almost entirely UNRATED.
  → ratings stats are low-signal for this user; build with graceful auto-hide when
  too few rated assets (mirror the Data-Quality "hidden when none" pattern).

## Time (col 11) — `HHMM` 24h string (e.g. `1200`, `0714`)
- This user's values are dominated by `1200` (placeholder) → time-of-day is LOW
  signal. Recommend dropping the time-of-day "media clock" from this build.

## Format (col 1): Photo 1939 / Audio 95 / Video 43 (heavily photo-skewed).

## Flags — low signal for this user
- Playback ∈ {`Unspecified`, `Not Used`, (`Used`?)} — NOT a plain boolean.
- Captive / Collected ∈ {`true`,`false`} (1248 populated). Unconfirmed all blank.
- → defer flags to Tier 3 / skip; little to show.

## Year/Month/Day (cols 8–10): populated; use these for temporal stats (no Date parsing).
## eBird Species Code (col 37) present → can resolve favicons without /taxonomy/codes (later).
