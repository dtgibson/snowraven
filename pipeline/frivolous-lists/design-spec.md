# Design Spec — Frivolous Lists

## Visual Direction
Designed **within** the established SnowRaven design system (extend, don't reinvent) — quiet utility, restrained green accent, the same `SectionCard` shell and the milestone-style green checkmarks/completion chip already used by the Firsts & Milestones section. The only new ingredient is a seven-color **rainbow swatch palette**, tokenized for both themes (a deliberate, logged extension — see `decisions.md`). The section reads as a light, fun coda at the bottom of the Statistics page without breaking the page's calm.

## Screens / Views

### Frivolous Lists section (final section of the Statistics page)
A standard `SectionCard` titled **Frivolous Lists** (Lucide `Sparkles` icon in the 30px accent-bg icon tile; no subtitle — removed per review). Three sub-blocks separated by the standard 1px `--sr-border-subtle` top border + 18px spacing:

1. **Avian American** — a `SubLabel` heading with a right-aligned `recorded / total` progress count (e.g. "12 / 22"). Birds render in a responsive grid (`auto-fill, minmax(230px, 1fr)`, ~2 columns at full width) in the given order; each row is a green checkmark (when recorded) or a same-width blank spacer (when not) + `<BirdName>`. A completion badge appears to the right of the count only when all are recorded.
2. **California Dreamer** — identical pattern for the 7 species. Shown complete in the mock ("7 / 7" + **Complete!** badge) to demonstrate the finished state.
3. **Rainbow Warrior** — seven rows in spectrum order (red → violet). A filled row sits on a `--sr-surface-subtle` rounded panel: color swatch + color name + `<BirdName>` + first-seen date (rendered as a `<ChecklistLink>` with the external-link glyph) + first-seen location (muted, ellipsis on overflow, hidden < 640px). An unfilled color (e.g. indigo) shows a dimmed swatch, the color name, and a muted italic "— no indigo bird yet", no panel and no link. A completion badge appears next to the count when all seven are filled.

Key decisions: name-lists stay a **two-column** responsive grid (compact for 22 entries); recorded birds use the accent link treatment + favicons, unrecorded birds are muted plain text (no link); the rainbow row keeps the date as the clickable element (link-on-the-number convention), name → Species Detail.

## Component Usage
- `SectionCard` (`statsPrimitives.tsx`) — the section shell; `SubLabel` for the three block headings; `Divider`/border-top between blocks.
- `<BirdName>` — every species name (size `sm`/`md`), `hasEntry` + `taxonCode` from the parent's `hasEntryFor`/`codeFor`.
- `<ChecklistLink>` — the Rainbow first-seen date (label = formatted date, `SUBMISSION_ID_RE`-guarded).
- Lucide icons — `Sparkles` (section header), the external-link glyph inside `ChecklistLink`, and the check glyph in the checkmark circle/badge.

## Design Tokens Applied
- Shell/text/border: `--sr-surface`, `--sr-surface-subtle`, `--sr-text`, `--sr-text-muted`, `--sr-text-disabled`, `--sr-border`, `--sr-border-subtle`, `--sr-border-medium`; accent + icon tile: `--sr-accent`, `--sr-accent-bg`.
- Checkmarks + completion badge: reuse the **milestone-1** tokens — `--sr-milestone-1-check` (#2D8653 green ✓), `--sr-milestone-1-bg` (light green gradient chip), `--sr-milestone-1-border`, `--sr-milestone-1-num` (badge text).
- **NEW — seven rainbow swatch tokens** (decorative swatch fills; the color name is the accessible text). Add to BOTH `:root` and `[data-theme="dark"]` in `globals.css`:

| Token | Light | Dark |
|---|---|---|
| `--sr-rainbow-red` | `#DC2626` | `#F87171` |
| `--sr-rainbow-orange` | `#EA580C` | `#FB923C` |
| `--sr-rainbow-yellow` | `#EAB308` | `#FACC15` |
| `--sr-rainbow-green` | `#16A34A` | `#4ADE80` |
| `--sr-rainbow-blue` | `#2563EB` | `#60A5FA` |
| `--sr-rainbow-indigo` | `#4F46E5` | `#818CF8` |
| `--sr-rainbow-violet` | `#7C3AED` | `#A78BFA` |

Each swatch carries a 1px `--sr-border-medium` ring so it stays delineated on any surface; an unfilled color's swatch is the same token at `opacity: 0.30`.

## Interaction Notes
- Recorded bird name → opens Species Detail (`onOpenSpecies`); unrecorded name is not a link.
- Rainbow date → opens that eBird checklist in a new tab (`ChecklistLink`).
- No hover-only affordances are required for comprehension; link/affordance hovers use the standard underline.
- Dark/light parity verified in the mock via the toggle; the milestone chips are intentionally light-tinted in both themes (matching the existing Statistics chips).

## Content Notes
- Section title: **Frivolous Lists**. Block titles: **Avian American**, **California Dreamer**, **Rainbow Warrior**.
- Completion badge copy: **Complete!** (short, celebratory but restrained — the Engineer/QA can confirm wording).
- Empty rainbow color copy: "— no {color} bird yet" in muted italic.
- Tone stays informative-with-a-wink, never promotional; consistent with the app's voice.
