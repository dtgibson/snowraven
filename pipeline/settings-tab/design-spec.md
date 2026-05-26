# Design Spec — Settings Tab

## Visual Direction
Consistent with the rest of SnowRaven — Irish clover green (#2D8653) for primary actions, zinc greys for borders and muted text, white card surfaces with 1px #E4E4E7 borders and 10px border radius. The tab reads as configuration rather than content: narrower max-width column, section headings in small caps, no data visualisation.

---

## Screens / Views

### Settings Tab

**Layout:** Centered column, max-width 680px, matching the app's content panels. Content starts below the shared tab bar. Sections stack vertically — the "Default Files" section is first; future settings sections follow the same card pattern below it.

**Section header:** Small-caps label (#71717A, 11px, 0.07em letter-spacing) with a horizontal rule extending to the right edge. Provides visual separation without weight.

**Settings card:** `border: 1px solid #E4E4E7`, `border-radius: 10px`, white background. Rows separated by `border-top: 1px solid #F4F4F5` (lighter than the card border — internal divider, not structural).

**File row (each stored file type):** Three-column flex:
1. Icon wrap — 38×38px, `border-radius: 9px`. Empty state: `#F4F4F5` background, muted grey icon. Saved state: `#E8F5EE` (accent green) background, green file-check icon.
2. Info block — file type label (13.5px, 600 weight, `#0F1117`) + sublabel. Empty sublabel: "Used by the [Tab Name] tab" in muted grey. Saved sublabel: filename (13px, 500 weight, truncated with ellipsis at 200px) + upload date in `#A1A1AA`.
3. Actions — right-aligned, flex row with gap 8px.

**Button states:**
- Empty state: "No file saved" chip (pill-shaped, `#F4F4F5` bg, `#A1A1AA` text, small info icon) + "Upload file" outline button + disabled "Clear" button (`#F4F4F5` bg, `#A1A1AA` text, `not-allowed` cursor)
- Saved state: "Upload new" ghost-green button (`#E8F5EE` bg, `rgba(45,134,83,0.25)` border, `#2D8653` text) + "Clear" destructive button (white bg, `#FECACA` border, `#DC2626` text)

**Section note:** 12px, `#A1A1AA`, below the card. Explains session-only behaviour for per-tab uploads.

### Breeding Codes and Media List toolbars (modified)

When a saved default is active, the controls row gains two elements flush-right:
- **Saved-file indicator chip:** `#E8F5EE` background, `rgba(45,134,83,0.25)` border, `#2D8653` text, small file icon, truncated filename. Height 28px, `border-radius: 6px`.
- **"Load different file" button:** ghost outline (`#E4E4E7` border, `#71717A` text). Returns the tab to idle/upload state without touching the server file.

---

## Component Usage

- **Settings card rows:** custom flex layout — not a shadcn Card component
- **Buttons:** custom inline styles consistent with existing app button patterns (`border-radius: 6px`, `height: 32px`)
- **Section heading + rule:** custom — matches the table header style (`font-size: 11px`, `font-weight: 600`, `text-transform: uppercase`)
- **File icon wrap:** custom — 38px square with rounded corners, colour changes with state
- **No-file chip:** custom pill — `border-radius: 12px`, `height: 24px`
- **Saved-file indicator:** custom chip — matches the A–Z/Taxonomic toggle styling language

---

## Design Tokens Applied

| Token | Value | Applied to |
|---|---|---|
| --primary | #2D8653 | Upload new button text, saved icon, saved indicator text/border |
| --accent | #E8F5EE | Saved icon wrap background, Upload new button background, saved indicator background |
| --foreground | #0F1117 | File type labels, saved filenames |
| --muted-foreground | #71717A | Section headings, sublabels, Load different file button |
| --border | #E4E4E7 | Card border, section rule, tab row divider |
| --muted | #F4F4F5 | Empty icon wrap background, disabled Clear button, internal row divider |
| --destructive | #DC2626 | Clear button text |
| `#FECACA` | — | Clear button border (lighter destructive) |
| `#A1A1AA` | — | Upload date, section note, no-file chip text |
| `#F4F4F5` | — | No-file chip background |

---

## Interaction Notes

- **Upload:** clicking "Upload file" or "Upload new" triggers a hidden `<input type="file" accept=".csv">`. On file selection, POST to `/settings/files/ebird` or `/settings/files/ml`. Show a loading state on the button during upload. On success, transition the row to the saved state with the returned filename and timestamp. On error, show an inline error message below the row.
- **Clear:** clicking "Clear" sends DELETE to the appropriate endpoint. On success, transition the row to the empty state. No confirmation dialog — the action is easily reversed by re-uploading.
- **Auto-load indicator in data tabs:** appears immediately if `GET /settings/files/{type}` returns 200 on mount. Disappears when the user clicks "Load different file" (tab returns to idle; server file is untouched).
- **Disabled Clear button:** `cursor: not-allowed`, muted background — visually clear that the action is unavailable, no tooltip needed.

---

## Content Notes

- File type labels use plain language: "eBird Backup", "ML Export" — not "MyEBirdData.csv format" or technical descriptions
- Sublabels name the destination tab: "Used by the Breeding Codes tab", "Used by the Media List tab"
- Section note is explanatory, not instructional: "Files are stored on this server and load automatically when you open the relevant tab. Uploading a different file within a tab is session-only and won't replace your saved default."
- Upload date format: "Saved 14 May 2026 at 11:42 PM" — plain and readable, not ISO 8601
- Saved-file indicator uses the raw filename (truncated) — no friendly label needed; the filename itself is meaningful to the user
