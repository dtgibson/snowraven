# Change Brief: Stats Tab Mobile Responsiveness + Nemesis Description

**Track:** Maintain  
**Feature flag:** None  
**Files touched:** `frontend/src/components/BirdingStats.tsx`

---

## What this improves

Two independent improvements to the Statistics tab, both entirely within `BirdingStats.tsx`. No new behavior, no new API calls, no schema changes.

---

## 1 — Mobile layout fixes

The Statistics tab uses rigid two-column grids and fixed-column-count grids that don't adapt to narrow viewports. On an iPhone (375px wide) several sections become cramped or overflow horizontally.

### Specific changes

**a. SectionCard padding**  
`padding: 24` → `padding: 'clamp(14px, 4vw, 24px)'`  
Reduces the 48px total side padding on narrow screens without affecting desktop.

**b. Temporal Stats — day-of-week / start-hour grid** (line 1317)  
`gridTemplateColumns: '1fr 1fr', gap: 32` → `gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16`  
Stacks to single column below ~400px content width.

**c. Geographic Stats — county grids** (line 1458)  
`gridTemplateColumns: '1fr 1fr', gap: 24` → `gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16`  
The county bar rows have 100px label widths that become unreadable in a 150px half-column.

**d. Geographic Stats — state grids** (line 1545)  
Same as (c).

**e. Effort Stats — key metrics grid** (line 1643)  
`gridTemplateColumns: 'repeat(4, 1fr)'` → `gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))'`  
On a 343px screen, 4 cells = 86px each — too tight for the 22px number + 10px label. This wraps to 2×2 on mobile.

**f. Breeding Stats — filter button row** (line 1930)  
Add `flexWrap: 'wrap', gap: 8` to the flex container holding the "Breeding activity by month" label + 4 filter buttons.  
Without wrapping, the 4 buttons overflow on narrow screens.

**g. Media section — controls row** (line 2023)  
Add `flexWrap: 'wrap', rowGap: 8` to the controls flex container.  
Per Period/Cumulative toggle + 4 interval buttons don't all fit on one row at 343px.

---

## 2 — Nemesis description correction + expansion

**Current text (line 2167):**  
> Nemesis birds are species recently reported within your area that don't yet appear on your life list, ranked by how frequently they've been seen.

**Problems:**
1. "Ranked by how frequently they've been seen" is factually wrong. The backend (`routers/stats.py`, line 56-63) sorts by most recent observation date descending — most recently seen first, not most frequently seen.
2. "Your area" is vague — it uses the location and radius from Settings.
3. "Recently" is undefined — the API uses `back: 30` (30 days).
4. The dot color legend is unexplained.

**Replacement:**  
A brief multi-part description that explains:
- Source: eBird observations from the past 30 days within your configured location + radius (Settings → Default Location)
- Filter: species not yet on your life list
- Sort: most recently seen first
- Dot key: red = seen in past 7 days, amber = 8–14 days, grey = 15–30 days

---

## What is explicitly NOT changing

- No new features (nemesis map is logged for `/new-feature`)
- No backend changes
- No data logic changes
- No new state, hooks, or components
- No test changes needed (layout styles are not unit-tested)
