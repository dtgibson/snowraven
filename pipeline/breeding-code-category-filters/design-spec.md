# Design Spec — Breeding Code Category Filters

## Filter Row Layout

Order (left to right): **All → Confirmed → Probable → Possible → divider → individual code pills → divider → sort toggle**

The dividers are the existing `<div style={{ width:1, height:20, background:'#E4E4E7' }} />` elements. One divider between the category/individual pill groups; one before the sort toggle (already present).

## Category Pill Appearance

All category pills: height 30px, padding `0 12px`, border-radius 6px, font-size 12px, font-weight 500. No tier dot — text label only.

### Inactive
```
border: 1.5px solid #E4E4E7
background: #fff
color: #71717A
```

### Active — Confirmed (tiers 3 + 4 palette)
```
border: 1.5px solid rgba(59,7,100,0.3)
background: rgba(59,7,100,0.08)
color: #3B0764
```

### Active — Probable (tier 2 palette)
```
border: 1.5px solid rgba(147,51,234,0.3)
background: rgba(147,51,234,0.08)
color: #7E22CE
```

### Active — Possible (tier 1 palette)
```
border: 1.5px solid rgba(192,132,252,0.5)
background: rgba(192,132,252,0.15)
color: #7E22CE
```

## Visibility Rule

A category pill is rendered only when `codesPresent` contains at least one code from that category's set. If the user's data has no tier-1 codes, "Possible" is not shown.

## Interaction Model

- Click inactive pill → adds to `categoryFilter`
- Click active pill → removes from `categoryFilter`
- Click "All" → clears both `categoryFilter` and `filter` (individual codes)
- Load new file → clears both

## Individual Code Pills

Unchanged. Same style, same position (after the category/divider section), same toggle behaviour.

## Count Label

Reflects the combined filter predicate at all times. No change to label format.

## States Illustrated

| State | Category filter | Individual filter | Result |
|-------|----------------|-------------------|--------|
| Default | empty | empty | All species |
| One category | {confirmed} | empty | Species with ≥1 confirmed code |
| Two categories | {confirmed, probable} | empty | Species with ≥1 confirmed AND ≥1 probable code |
| Category + code | {confirmed} | {FY} | Species with ≥1 confirmed code AND specifically FY |
| Missing category | Possible hidden | — | No tier-1 codes in data |

## Reference File

`pipeline/breeding-code-category-filters/design.html` — interactive mockup showing all five states.
