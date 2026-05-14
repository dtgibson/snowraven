# Strategic Brief — Media List Links and Sorting

## Feature Overview

Four focused improvements to the Media Life List table that together make it more informative, more navigable, and less cluttered.

**What the user asked for:**
1. Media counts (Photo, Audio, Video) become clickable links that open Macaulay Library filtered to that species and media type in the user's personal uploads
2. The "Media" column (always-present checkmark) is removed — redundant because every row in the list represents an entry with media
3. The A–Z sort button is removed — with column-click sorting replacing it, a standalone button adds no value
4. Column headers become clickable sort triggers: clicking "Entries" sorts by name, clicking "Photo" sorts by photo count, "Audio" by audio count, "Video" by video count

**Why these belong together:** Each change removes something redundant or adds something more useful. They don't conflict, they reinforce each other — the table gets narrower (one fewer column), more scannable (sortable), and more actionable (counts become navigation).

---

## Strategic Alignment

SnowRaven is a personal tool for a birder who wants to understand and act on their own data. The Media Life List already shows *what* the user has — these changes let them *go to* it. A count of 3 audio recordings is more useful when clicking it takes the user directly to those three recordings on Macaulay Library, ready to review or share.

Removing the "Media" column and the sort button follow the same principle: don't show what the user already knows. Every row has media (that's the definition of the list), and if columns are sortable by click, a dedicated sort button is redundant noise.

---

## User Value

- **Counts as navigation:** The user sees they have 7 photos of Yellow Warbler. Clicking "7" takes them directly to those photos on ML — no searching required.
- **Sortable by what matters:** The user can rank species by how many recordings they have — useful for finding their most-documented species or identifying gaps.
- **Less clutter:** Two fewer UI elements (column + button) without losing any information.

---

## Risks and Constraints

- **Macaulay Library link format:** The ML website's URL structure for filtering personal media by species and type needs to be confirmed during the Architect stage. If a direct "my media" filtered URL is not available, the fallback is the ML catalog search filtered by species and media type (which works for logged-in users).
- **eBird path:** The eBird backup CSV path also populates the table. Link behavior needs to be consistent — the same catalog IDs are available on both paths, so Macaulay Library asset links are feasible for both.
- **Sort state:** Replacing the `SortOrder` type with a column-based sort model is a small but real type system change. The Architect will confirm scope.
- **Accessibility:** Clickable column headers need visible affordance (cursor, hover state) to signal interactivity.

---

## Out of Scope

- Changes to filter pills
- Any change to the eBird backup CSV parser or ML export parser
- Mobile-specific layout changes
- Saving or persisting sort state between sessions
